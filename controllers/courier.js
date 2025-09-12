const axios = require("axios");
const Order = require("../models/order");
const Product = require("../models/product");
const Counter = require("../models/counter");
const { getCityIdByName, suggestCities, getCities } = require("../services/lcs");

// Env: product description keying strategy (module-scope for use across builders)
const PRODUCT_KEY = (process.env.LCS_PRODUCT_KEY || "").trim();
const PRODUCT_STRICT =
  String(process.env.LCS_PRODUCT_STRICT || "false").toLowerCase() === "true";

// Utility: map our order to LCS payloads
function mapOrderToLCSPayload(order, overrideWeightG) {
  const addr = order?.shippingAddress || {}
  const lcsResolution = order?.shippingProvider?.extra?.lcsResolution || null;
  const items = Array.isArray(order?.cartSummary) ? order.cartSummary : [];
  const pieces =
    items.reduce((sum, it) => sum + Number(it?.count || 0), 0) || 1;
  const codAmountRaw = Number(order?.totalPrice || 0);
  const FORCE_PREPAID = process.env.LCS_FORCE_PREPAID === "true";
  const codAmount = FORCE_PREPAID ? 0 : codAmountRaw;
  // Build product fields robustly: prefer first title; else join titles; else env; else 'Item'
  const DEFAULT_PRODUCT = String(process.env.LCS_DEFAULT_PRODUCT || "").trim();
  const titles = items
    .map((it) => String(it?.title || "").trim())
    .filter(Boolean);
  const rawProduct =
    titles[0] ||
    (titles.length ? titles.slice(0, 3).join(", ") : "") ||
    DEFAULT_PRODUCT ||
    "Item";
  const toTitleCase = (s) =>
    s.replace(
      /\w\S*/g,
      (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    );
  // Build a readable, concise title
  const MAX_LEN = Math.max(
    20,
    Math.min(240, Number(process.env.LCS_PRODUCT_MAX_LEN || 100))
  );
  const ALLOW_VARIANTS = String(
    process.env.LCS_PRODUCT_INCLUDE_VARIANTS || "true"
  ).toLowerCase() === "true";
  const sanitize = (s) => {
    if (!s) return "";
    let out = String(s);
    // Remove bracketed noise like [Free], (Pack of 2), {Promo}
    out = out.replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, " ");
    // Remove common marketing words
    out = out.replace(
      /\b(official|original|brand new|best quality|premium|sale|discount|limited|offer|deal|with warranty)\b/gi,
      " "
    );
    // Remove obvious SKU-like tokens (mix of letters+digits with dashes/underscores)
    out = out.replace(/\b[A-Z]{2,}[-_]*\d+[A-Z\d-]*\b/gi, " ");
    // Remove emojis and non-ASCII symbols
    out = out.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
    // Keep letters, numbers, spaces, basic punctuation
    out = out.replace(/[^A-Za-z0-9&+,.\-\s]/g, " ");
    // Collapse punctuation runs and whitespace
    out = out.replace(/[\s.,-]{2,}/g, " ");
    out = out.replace(/\s+/g, " ").trim();
    return out;
  };
  // Optional concise variant snippet from first item's selectedVariants
  const mkVariantSnippet = (it) => {
    try {
      if (!ALLOW_VARIANTS) return "";
      const vals = Array.isArray(it?.selectedVariants)
        ? it.selectedVariants
        : [];
      const flat = vals
        .map((v) => String(v?.value || "").trim())
        .filter(Boolean)
        .slice(0, 2); // at most two
      return flat.length ? ` · ${flat.join("/")}` : "";
    } catch {
      return "";
    }
  };
  const primaryItem = items[0] || {};
  const base = sanitize(rawProduct);
  const combined = toTitleCase((base + mkVariantSnippet(primaryItem)).trim());
  const productDetail =
    combined.length > MAX_LEN
      ? combined.slice(0, MAX_LEN).trim()
      : combined;
  const SEND_CUSTOM = process.env.LCS_SEND_CUSTOM_DATA === "true";
  const customData = SEND_CUSTOM
    ? JSON.stringify(
        items.slice(0, 20).map((it) => ({
          title: it?.title || "",
          qty: Number(it?.count || 0),
          price: Number(it?.price || 0),
        }))
      )
    : undefined; // omit by default to avoid validator issues

  // Env-driven shipper fields. If 'self', LCS uses the account defaults.
  const SHIPPER_NAME = process.env.LCS_SHIPPER_NAME || "self";
  const SHIPPER_EMAIL = process.env.LCS_SHIPPER_EMAIL || "self";
  const SHIPPER_PHONE = process.env.LCS_SHIPPER_PHONE || "self";
  const SHIPPER_ADDRESS = process.env.LCS_SHIPPER_ADDRESS || "self";
  // Explicit shipper profile selection (from portal shipper listing -> Sys Id #)
  const SHIPPER_ID = Number(process.env.LCS_SHIPPER_ID || 0) || undefined;
  const ORIGIN_CITY = process.env.LCS_ORIGIN_CITY || "self"; // city id or 'self'
  const RETURN_ADDRESS = process.env.LCS_RETURN_ADDRESS || "";
  const RETURN_CITY = process.env.LCS_RETURN_CITY || ""; // integer city id if provided
  // Clean env default remarks by stripping wrapping quotes if present
  const DEFAULT_REMARKS = String(process.env.LCS_DEFAULT_REMARKS || "").replace(
    /^['"]|['"]$/g,
    ""
  );
  const specialInstructions = String(
    addr?.additionalInstructions || DEFAULT_REMARKS || "-"
  );
  // Booking type and service code defaults (observed in manual bookings)
  const BOOKING_TYPE_ID = Number(process.env.LCS_BOOKING_TYPE_ID || 2); // typical 2
  const SERVICE_CODE = String(process.env.LCS_SERVICE_CODE || "GO"); // e.g., GO for Overnight
  const SHIPMENT_TYPE_ID = Number(process.env.LCS_SHIPMENT_TYPE_ID || 10); // manual payload shows 10
  // Additional fields observed in manual booking payload
  const BOOKED_PACKET_OPTION = Number(
    process.env.LCS_BOOKED_PACKET_OPTION || 1
  ); // 1 in manual
  const PAYMENT_TYPE = Number(process.env.LCS_PAYMENT_TYPE || 0); // 0 in manual
  const ALLOW_TO_OPEN = Number(process.env.LCS_ALLOW_TO_OPEN || 0); // 0 in manual
  // Product description posting strategy
  const PRODUCT_KEY = (process.env.LCS_PRODUCT_KEY || "").trim();
  const PRODUCT_STRICT =
    String(process.env.LCS_PRODUCT_STRICT || "false").toLowerCase() === "true";

  // Weight: LCS expects grams. Default 1kg = 1000g if not provided
  const defaultWeightG = Math.max(
    1,
    Number(process.env.LCS_DEFAULT_WEIGHT_G) || 1000
  );
  const weightGrams = Math.max(1, Number(overrideWeightG) || defaultWeightG);
  // Product in LCS portal list is driven by shipment_id preset on merchant account
  const SHIPMENT_ID = Number(process.env.LCS_SHIPMENT_ID || 0);

  const destinationCityValue = lcsResolution?.id ?? addr.city ?? "";

  return {
    // Credentials will be merged upstream
    origin_city: ORIGIN_CITY, // 'self' or integer city id
    // Prefer resolved LCS city id if available; LCS accepts either id or name in this field
    destination_city: destinationCityValue,
    // Add explicit id/name fields for environments that require them
    destination_city_id: lcsResolution?.id ? Number(lcsResolution.id) : undefined,
    destination_city_name: lcsResolution?.name || undefined,

    shipment_id: SHIPMENT_ID, // LCS portal product column uses this preset ID
    shipment_name_eng: SHIPPER_NAME,
    shipment_name: SHIPPER_NAME,
    shipment_email: SHIPPER_EMAIL,
    shipment_phone: SHIPPER_PHONE,
    shipment_address: SHIPPER_ADDRESS,
    shipper_id: SHIPPER_ID,
    // alias keys some LCS variants accept
    shipper_name: SHIPPER_NAME,
    shipper_name_eng: SHIPPER_NAME,
    shipper_phone: SHIPPER_PHONE,
    shipper_address: SHIPPER_ADDRESS,

    consignee_name_eng: addr.fullName || "",
    consignee_name: addr.fullName || "",
    consignee_email: "",
    consignee_phone: addr.mobile || "",
    consignee_phone_two: "",
    consignee_phone_three: "",
    consignee_address: `${addr.streetAddress || ""}`.trim(),

    // Some LCS environments require non-empty special instructions
    special_instructions:
      (addr.additionalInstructions &&
        String(addr.additionalInstructions).trim()) ||
      "-",
    shipment_type: "", // empty uses default (e.g., overnight) per docs
    custom_data: "", // optional json array string if needed

    return_address: RETURN_ADDRESS,
    return_city: RETURN_CITY, // int id optional; empty => origin will be used
    is_vpc: 0,

    booked_packet_weight: weightGrams, // grams
    booked_packet_vol_weight_w: "",
    booked_packet_vol_weight_h: "",
    booked_packet_vol_weight_l: "",
    booked_packet_no_piece: pieces,
    booked_packet_collect_amount: codAmount, // COD amount (0 if LCS_FORCE_PREPAID=true)
    // Human-friendly order reference (sequential); fallback to mongo id only if missing
    booked_packet_order_id: String(
      order?.orderShortId ?? order?.orderNumber ?? order?._id
    ),
    // Extra details for portal visibility
    product_detail: productDetail,
    product_description: productDetail,
    special_instructions: specialInstructions,
    // Manual payload parity
    booked_packet_option: BOOKED_PACKET_OPTION,
    payment_type: PAYMENT_TYPE,
    allow_to_open: ALLOW_TO_OPEN,
    booked_packet_comments: String(
      DEFAULT_REMARKS || specialInstructions || ""
    ).toLowerCase(),
    booking_type_id: BOOKING_TYPE_ID,
    service_code: SERVICE_CODE,
    shipment_type_id: SHIPMENT_TYPE_ID,
    // Item counts
    items: Array.isArray(items)
      ? items.reduce((n, it) => n + Number(it?.count || 1), 0)
      : 1,
  };
}

async function pushSelectedToLCS(req, res) {
  try {
    const { orderIds } = req.body || {};
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res
        .status(400)
        .json({ message: "orderIds must be a non-empty array" });
    }

    // LCS credentials & base URL
    const LCS_BASE_URL = process.env.LCS_BASE_URL; // e.g. https://merchantapistaging.leopardscourier.com/api/
    const LCS_API_KEY = process.env.LCS_API_KEY;
    const LCS_API_PASSWORD = process.env.LCS_API_PASSWORD;

    if (!LCS_BASE_URL || !LCS_API_KEY || !LCS_API_PASSWORD) {
      return res.status(400).json({
        message:
          "LCS credentials not configured. Please set LCS_BASE_URL, LCS_API_KEY, LCS_API_PASSWORD in environment.",
      });
    }

    // Safety guard: block accidental production pushes unless explicitly allowed
    const PROD_HOST = "merchantapi.leopardscourier.com";
    const isProdBase = String(LCS_BASE_URL || "").includes(PROD_HOST);
    const allowProd = process.env.LCS_ALLOW_PROD_PUSH === "true";
    if (isProdBase && !allowProd) {
      return res.status(403).json({
        message:
          'Blocked: LCS_BASE_URL points to PRODUCTION but LCS_ALLOW_PROD_PUSH is not set to "true". Set LCS_ALLOW_PROD_PUSH=true to enable live bookings.',
      });
    }

    // Normalize base URL to ensure trailing slash
    const BASE_URL = String(LCS_BASE_URL).endsWith("/")
      ? String(LCS_BASE_URL)
      : `${String(LCS_BASE_URL)}/`;

    const orders = await Order.find({ _id: { $in: orderIds } });
    const results = [];

    // Toggle to enable/disable destination city ID usage
    const USE_CITY_ID = process.env.LCS_USE_CITY_ID !== "false";

    for (const order of orders) {
      try {
        // Prevent duplicate push to LCS unless explicitly allowed
        const rebookAllowed = process.env.LCS_ALLOW_REBOOK === 'true' || req.body?.forceRebook === true;
        const alreadyPushed = Boolean(order?.shippingProvider?.pushed) || Boolean(order?.shippingProvider?.consignmentNo) || Boolean(order?.shippingProvider?.trackingNumber);
        if (alreadyPushed && !rebookAllowed) {
          results.push({
            orderId: order._id,
            ok: false,
            error: `Already booked to LCS (CN: ${order?.shippingProvider?.consignmentNo || order?.shippingProvider?.trackingNumber || 'unknown'})`,
            consignmentNo: order?.shippingProvider?.consignmentNo || null,
            trackingNumber: order?.shippingProvider?.trackingNumber || null,
            slip: order?.shippingProvider?.labelUrl || null,
          });
          continue;
        }
        // TEMP: verify credentials are loaded correctly (masked)
        const mask = (s) => {
          if (!s) return "(empty)";
          const str = String(s).trim();
          if (str.length <= 8) return `${str}`;
          return `${str.slice(0, 4)}...(${str.length})...${str.slice(-4)}`;
        };
        // console.log("[LCS][AUTH] base", LCS_BASE_URL);
        // console.log("[LCS][AUTH] key", mask(LCS_API_KEY));
        // console.log("[LCS][AUTH] pwd", mask(LCS_API_PASSWORD));

        // Ensure a short, human-friendly order ID
        if (!order.orderShortId) {
          const next = await Counter.findByIdAndUpdate(
            { _id: "order" },
            { $inc: { seq: 1 } },
            { upsert: true, new: true }
          );
          // Apply portal-friendly base offset
          order.orderShortId = 1000 + Number(next.seq || 0);
          await order.save();
        }

        // Compute shipment weight from products (sum of product.weight * qty) and convert to grams
        let computedWeightG = 0;
        try {
          const items = Array.isArray(order?.cartSummary)
            ? order.cartSummary
            : [];
          const ids = items.map((it) => it?.productId).filter(Boolean);
          const unitEnv = String(
            process.env.LCS_PRODUCT_WEIGHT_UNIT || "g"
          ).toLowerCase(); // 'g' or 'kg'
          if (ids.length) {
            const prods = await Product.find(
              { _id: { $in: ids } },
              { _id: 1, weight: 1 }
            );
            const map = new Map(
              prods.map((p) => [String(p._id), Number(p.weight || 0)])
            );
            for (const it of items) {
              const qty = Number(it?.count || 0) || 0;
              // Prefer product.weight from DB; fallback to item.weight if present
              const w =
                (map.get(String(it.productId)) ?? Number(it?.weight || 0)) || 0;
              if (w > 0 && qty > 0) {
                const wG = unitEnv === "kg" ? w * 1000 : w; // assume 'g' if not 'kg'
                computedWeightG += wG * qty;
              }
            }
          }
          // Ensure a sane minimum if nothing found
          if (!computedWeightG || computedWeightG < 1)
            computedWeightG = undefined; // let mapper use default
        } catch (e) {
          // leave computedWeightG undefined to fall back to default
        }

        const mapped = mapOrderToLCSPayload(order, computedWeightG);
        // Validate required consignee fields before calling LCS
        if (!mapped.consignee_phone) {
          console.warn(
            "[LCS][SKIP] Missing consignee phone for order",
            String(order._id)
          );
          throw new Error("Consignee Phone is required");
        }
        if (!mapped.consignee_address) {
          console.warn(
            "[LCS][SKIP] Missing consignee address for order",
            String(order._id)
          );
          throw new Error("Consignee Address is required");
        }
        // Merge API credentials as required by LCS docs (POST body)
        const payload = {
          api_key: LCS_API_KEY,
          api_password: LCS_API_PASSWORD,
          ...mapped,
        };
        // Provide alternate keys for consignee (some environments expect these)
        payload.consignee_mobile =
          payload.consignee_mobile || payload.consignee_phone || "";
        payload.consignee_number =
          payload.consignee_number || payload.consignee_phone || "";
        payload.consignee_cell =
          payload.consignee_cell || payload.consignee_phone || "";
        payload.consignee_address_eng =
          payload.consignee_address_eng || payload.consignee_address || "";
        // Additional casing variants (defensive)
        payload.ConsigneePhone =
          payload.ConsigneePhone || payload.consignee_phone || "";
        payload.Consignee_Address =
          payload.Consignee_Address || payload.consignee_address || "";
        payload.consigneeAddress =
          payload.consigneeAddress || payload.consignee_address || "";
        payload.consigneePhone =
          payload.consigneePhone || payload.consignee_phone || "";

        // Shipment/shipper alias variants
        payload.ShipmentName =
          payload.ShipmentName ||
          payload.shipment_name ||
          payload.shipment_name_eng ||
          payload.shipper_name ||
          "";
        payload.ShipperName =
          payload.ShipperName ||
          payload.shipper_name ||
          payload.shipment_name ||
          payload.shipment_name_eng ||
          "";
        payload.shipmentName =
          payload.shipmentName ||
          payload.shipment_name ||
          payload.shipment_name_eng ||
          "";

        // Try to resolve destination city with pre-push guard
        if (USE_CITY_ID) {
          const manual = order?.shippingProvider?.extra?.lcsResolution;
          if (manual?.id) {
            // Use previously resolved city id, skip auto-resolution
            payload.destination_city = manual.id;
          } else {
            const cityText = order?.shippingAddress?.city || '';
            if (!cityText) {
              results.push({
                orderId: order._id,
                ok: false,
                error: 'Missing city in shipping address',
                code: 'UNSERVICEABLE_CITY',
              });
              continue;
            }
            try {
              const resolved = await getCityIdByName(cityText);
              const AUT0MAP = String(process.env.LCS_CITY_AUTOMAP || 'true') !== 'false';
              const conf = resolved ? (resolved.method === 'exact' || resolved.method === 'alias' ? 1.0 : 0.9) : 0;
              const MIN_CONF = Math.max(0, Math.min(1, Number(process.env.LCS_CITY_AUTOMAP_CONF || 0.85)));

              if (resolved?.id && (AUT0MAP ? conf >= MIN_CONF : (resolved.method === 'exact' || resolved.method === 'alias'))) {
                payload.destination_city = resolved.id;
                // persist resolution into shippingProvider.extra to avoid schema changes
                order.shippingProvider = order.shippingProvider || {};
                order.shippingProvider.extra = Object.assign({}, order.shippingProvider.extra, {
                  lcsResolution: {
                    cityInput: cityText,
                    id: resolved.id,
                    name: resolved.name || null,
                    method: resolved.method,
                    confidence: conf,
                    resolvedAt: new Date(),
                  }
                });
                await order.save();
              } else {
                // Not confidently resolvable: produce suggestions and skip booking this order
                const suggestions = await suggestCities(cityText, 5);
                results.push({
                  orderId: order._id,
                  ok: false,
                  error: `Unserviceable or ambiguous city: "${cityText}"`,
                  code: 'UNSERVICEABLE_CITY',
                  suggestions: suggestions.map(s => ({ id: s.id, name: s.name, score: Number(s.score?.toFixed?.(2) || s.score) })),
                });
                continue;
              }
            } catch (e) {
              results.push({
                orderId: order._id,
                ok: false,
                error: e?.message || 'City resolution failed',
                code: 'CITY_RESOLUTION_ERROR',
              });
              continue;
            }
          }
        }

        // Coerce numeric city fields where applicable
        const toNum = (v) =>
          v !== undefined && v !== null && /^\d+$/.test(String(v))
            ? Number(v)
            : v;
        payload.origin_city = toNum(payload.origin_city);
        payload.destination_city = toNum(payload.destination_city);

        // TEMP DEBUG: log key payload fields
        console.log("[LCS][BOOK] order", String(order._id), {
          shipment_name_eng: payload.shipment_name_eng,
          shipment_name: payload.shipment_name,
          shipment_phone: payload.shipment_phone,
          shipment_address: payload.shipment_address,
          origin_city: payload.origin_city,
          consignee_name_eng: payload.consignee_name_eng,
          consignee_phone: payload.consignee_phone,
          consignee_mobile: payload.consignee_mobile,
          consignee_address: payload.consignee_address,
          consignee_address_eng: payload.consignee_address_eng,
          destination_city: payload.destination_city,
          special_instructions: payload.special_instructions,
          product_detail: payload.product_detail,
          product_description: payload.product_description,
          booked_packet_weight_g: payload.booked_packet_weight,
          booked_packet_order_id: payload.booked_packet_order_id,
        });

        // Build payload only with essential fields, and conditionally include shipper
        const strictPayload = {
          api_key: payload.api_key,
          api_password: payload.api_password,
          origin_city: payload.origin_city,
          destination_city: payload.destination_city,
          shipper_id: payload.shipper_id,
          shipment_id:
            Number(payload.shipment_id) > 0
              ? Number(payload.shipment_id)
              : undefined,
          booking_type_id: payload.booking_type_id,
          service_code: payload.service_code,
          shipment_type_id: payload.shipment_type_id,
          booked_packet_option: payload.booked_packet_option,
          payment_type: payload.payment_type,
          allow_to_open: payload.allow_to_open,
          booked_packet_comments: payload.booked_packet_comments,
          items: payload.items,
          // Consignee required fields (primary CamelCase keys)
          ConsigneeName: payload.consignee_name || payload.consignee_name_eng,
          ConsigneePhone: payload.consignee_phone || payload.consignee_mobile,
          ConsigneeAddress: payload.consignee_address,
          // Remaining fields unchanged
          special_instructions: payload.special_instructions,
          booked_packet_weight: payload.booked_packet_weight,
          booked_packet_no_piece: payload.booked_packet_no_piece,
          booked_packet_collect_amount: payload.booked_packet_collect_amount,
          booked_packet_order_id: payload.booked_packet_order_id,
          // Optional explicit destination fields for environments that accept them
          destination_city_id: payload.destination_city_id,
          destination_city_name: payload.destination_city_name,
        };
        // Only send Shipper fields if explicitly configured (avoid sending 'self')
        const hasExplicitShipper = [
          payload.shipper_name,
          payload.shipment_name_eng,
          payload.shipment_name,
        ].some((v) => v && String(v).toLowerCase() !== "self");
        if (hasExplicitShipper) {
          strictPayload.ShipperName =
            payload.shipper_name ||
            payload.shipment_name_eng ||
            payload.shipment_name;
          if (payload.shipper_phone || payload.shipment_phone) {
            strictPayload.ShipperPhone =
              payload.shipper_phone || payload.shipment_phone;
          }
          if (payload.shipper_address || payload.shipment_address) {
            strictPayload.ShipperAddress =
              payload.shipper_address || payload.shipment_address;
          }
        }

        let apiRes;
        const requestUrl = `${BASE_URL}bookPacket/format/json/`;
        const strictKeys = [];
        for (const [k, v] of Object.entries(strictPayload)) {
          if (v !== undefined && v !== null && v !== "") {
            if (!["api_password"].includes(k)) strictKeys.push(k);
          }
        }
        const FORCE_MULTIPART = process.env.LCS_FORCE_MULTIPART === "true";
        if (!FORCE_MULTIPART)
          try {
            // Send as application/x-www-form-urlencoded first (per LCS docs) using lowercase-only keys
            const form = new URLSearchParams();
            const postedKeys = [];
            const toStr = (v) =>
              v === undefined || v === null ? "" : String(v).trim();
            const style = (
              process.env.LCS_FIELD_STYLE || "snake"
            ).toLowerCase();
            const mask = (s) => {
              const str = toStr(s);
              if (!str) return "(empty)";
              if (str.length <= 4) return "****";
              return `${str.slice(0, 2)}***${str.slice(-2)}`;
            };
            // Required creds
            form.append("api_key", toStr(strictPayload.api_key));
            postedKeys.push("api_key");
            form.append("api_password", toStr(strictPayload.api_password));
            postedKeys.push("api_password");
            if (style === "camel") {
              // Shipper (CamelCase only)
              if (strictPayload.ShipperName) {
                form.append("ShipperName", toStr(strictPayload.ShipperName));
                postedKeys.push("ShipperName");
              }
              if (strictPayload.ShipperPhone) {
                form.append("ShipperPhone", toStr(strictPayload.ShipperPhone));
                postedKeys.push("ShipperPhone");
              }
              if (strictPayload.ShipperAddress) {
                form.append(
                  "ShipperAddress",
                  toStr(strictPayload.ShipperAddress)
                );
                postedKeys.push("ShipperAddress");
              }
              // Shipper selection by ID (CamelCase alias)
              if (strictPayload.shipper_id) {
                form.append("ShipperId", toStr(strictPayload.shipper_id));
                postedKeys.push("ShipperId");
              }
              // Consignee
              form.append("ConsigneeName", toStr(strictPayload.ConsigneeName));
              postedKeys.push("ConsigneeName");
              form.append(
                "ConsigneeAddress",
                toStr(strictPayload.ConsigneeAddress)
              );
              postedKeys.push("ConsigneeAddress");
              // Cities (CamelCase)
              if (strictPayload.origin_city !== undefined) {
                form.append("OriginCity", toStr(strictPayload.origin_city));
                postedKeys.push("OriginCity");
              }
              if (strictPayload.destination_city !== undefined) {
                form.append("DestinationCity", toStr(strictPayload.destination_city));
                postedKeys.push("DestinationCity");
              }
              if (strictPayload.destination_city_id !== undefined) {
                form.append("DestinationCityId", toStr(strictPayload.destination_city_id));
                postedKeys.push("DestinationCityId");
              }
              if (strictPayload.destination_city_name) {
                form.append("DestinationCityName", toStr(strictPayload.destination_city_name));
                postedKeys.push("DestinationCityName");
              }
            } else {
              // Shipper (snake)
              if (strictPayload.ShipperName) {
                form.append("shipment_name", toStr(strictPayload.ShipperName));
                postedKeys.push("shipment_name");
                form.append(
                  "shipment_name_eng",
                  toStr(strictPayload.ShipperName)
                );
                postedKeys.push("shipment_name_eng");
              }
              if (strictPayload.ShipperPhone) {
                form.append(
                  "shipment_phone",
                  toStr(strictPayload.ShipperPhone)
                );
                postedKeys.push("shipment_phone");
              }
              if (strictPayload.ShipperAddress) {
                form.append(
                  "shipment_address",
                  toStr(strictPayload.ShipperAddress)
                );
                postedKeys.push("shipment_address");
              }
              // Shipper selection by ID (snake + variants used in some environments)
              if (strictPayload.shipper_id) {
                form.append("shipper_id", toStr(strictPayload.shipper_id));
                postedKeys.push("shipper_id");
                form.append("shipper_sys_id", toStr(strictPayload.shipper_id));
                postedKeys.push("shipper_sys_id");
                form.append("shipper_sysid", toStr(strictPayload.shipper_id));
                postedKeys.push("shipper_sysid");
              }
              // Consignee (snake)
              form.append("consignee_name", toStr(strictPayload.ConsigneeName));
              postedKeys.push("consignee_name");
              form.append(
                "consignment_name",
                toStr(strictPayload.ConsigneeName)
              );
              postedKeys.push("consignment_name");
              form.append(
                "consignment_name_eng",
                toStr(strictPayload.ConsigneeName)
              );
              postedKeys.push("consignment_name_eng");
              form.append(
                "consignee_address",
                toStr(strictPayload.ConsigneeAddress)
              );
              postedKeys.push("consignee_address");
              form.append(
                "consignment_address",
                toStr(strictPayload.ConsigneeAddress)
              );
              postedKeys.push("consignment_address");
              // Hybrid duplicates for validator wording
              if (strictPayload.ShipperName) {
                form.append("ShipperName", toStr(strictPayload.ShipperName));
                postedKeys.push("ShipperName");
              }
              if (strictPayload.ShipperPhone) {
                form.append("ShipperPhone", toStr(strictPayload.ShipperPhone));
                postedKeys.push("ShipperPhone");
              }
              if (strictPayload.ShipperAddress) {
                form.append(
                  "ShipperAddress",
                  toStr(strictPayload.ShipperAddress)
                );
                postedKeys.push("ShipperAddress");
              }
              if (strictPayload.ConsigneeName) {
                form.append(
                  "ConsigneeName",
                  toStr(strictPayload.ConsigneeName)
                );
                postedKeys.push("ConsigneeName");
              }
            }
            // Docs also show shipment_name_eng and consignment_* keys
            const rawPhone = String(strictPayload.ConsigneePhone || "").replace(
              /\D+/g,
              ""
            );
            const local03 = rawPhone;
            const with92 = rawPhone.startsWith("92")
              ? rawPhone
              : rawPhone.startsWith("0")
              ? `92${rawPhone.slice(1)}`
              : rawPhone;
            // Prefer local 03 first for production, then 92
            if (style === "camel") {
              form.append("ConsigneePhone", toStr(local03));
              postedKeys.push("ConsigneePhone");
              // Cities (CamelCase)
              form.append("OriginCity", toStr(strictPayload.origin_city));
              postedKeys.push("OriginCity");
              form.append(
                "DestinationCity",
                toStr(strictPayload.destination_city)
              );
              postedKeys.push("DestinationCity");
            } else {
              form.append("consignee_phone", toStr(local03));
              postedKeys.push("consignee_phone");
              form.append("consignment_phone", toStr(local03));
              postedKeys.push("consignment_phone");
              form.append("consignment_phone_two", toStr(with92));
              postedKeys.push("consignment_phone_two");
              form.append("consignee_mobile", toStr(with92));
              postedKeys.push("consignee_mobile");
              // Cities (snake)
              form.append("origin_city", toStr(strictPayload.origin_city));
              postedKeys.push("origin_city");
              form.append(
                "destination_city",
                toStr(strictPayload.destination_city)
              );
              postedKeys.push("destination_city");
              // Hybrid duplicates for validator wording (keep cities snake only)
              form.append("ConsigneePhone", toStr(local03));
              postedKeys.push("ConsigneePhone");
              form.append(
                "ConsigneeAddress",
                toStr(strictPayload.ConsigneeAddress)
              );
              postedKeys.push("ConsigneeAddress");
            }
            // Add consignment_* fields per docs (always snake_case)
            form.append("consignment_name", toStr(strictPayload.ConsigneeName));
            postedKeys.push("consignment_name");
            form.append(
              "consignment_name_eng",
              toStr(strictPayload.ConsigneeName)
            );
            postedKeys.push("consignment_name_eng");
            form.append("consignment_phone", toStr(local03));
            postedKeys.push("consignment_phone");
            form.append("consignment_phone_two", toStr(with92));
            postedKeys.push("consignment_phone_two");
            form.append(
              "consignment_address",
              toStr(strictPayload.ConsigneeAddress)
            );
            postedKeys.push("consignment_address");
            // Parcel
            const allowShipmentId = process.env.LCS_OMIT_SHIPMENT_ID !== "true";
            if (allowShipmentId && strictPayload.shipment_id !== undefined) {
              // Some tenants use shipment_id, others use product_id for the Product preset
              form.append("shipment_id", toStr(strictPayload.shipment_id));
              postedKeys.push("shipment_id");
              form.append("product_id", toStr(strictPayload.shipment_id));
              postedKeys.push("product_id");
            }
            form.append(
              "booked_packet_weight",
              toStr(payload.booked_packet_weight)
            );
            postedKeys.push("booked_packet_weight");
            form.append(
              "booked_packet_no_piece",
              toStr(payload.booked_packet_no_piece)
            );
            postedKeys.push("booked_packet_no_piece");
            form.append(
              "booked_packet_collect_amount",
              toStr(payload.booked_packet_collect_amount)
            );
            postedKeys.push("booked_packet_collect_amount");
            // Booking type and service code
            if (strictPayload.booking_type_id) {
              form.append(
                "booking_type_id",
                toStr(strictPayload.booking_type_id)
              );
              postedKeys.push("booking_type_id");
            }
            if (strictPayload.service_code) {
              form.append("service_code", toStr(strictPayload.service_code));
              postedKeys.push("service_code");
            }
            if (strictPayload.shipment_type_id) {
              form.append(
                "shipment_type_id",
                toStr(strictPayload.shipment_type_id)
              );
              postedKeys.push("shipment_type_id");
            }
            if (strictPayload.booked_packet_option !== undefined) {
              form.append(
                "booked_packet_option",
                toStr(strictPayload.booked_packet_option)
              );
              postedKeys.push("booked_packet_option");
            }
            if (strictPayload.payment_type !== undefined) {
              form.append("payment_type", toStr(strictPayload.payment_type));
              postedKeys.push("payment_type");
            }
            if (strictPayload.allow_to_open !== undefined) {
              form.append("allow_to_open", toStr(strictPayload.allow_to_open));
              postedKeys.push("allow_to_open");
            }
            if (strictPayload.booked_packet_comments) {
              form.append(
                "booked_packet_comments",
                toStr(strictPayload.booked_packet_comments)
              );
              postedKeys.push("booked_packet_comments");
            }
            // Items aliases
            if (strictPayload.items) {
              form.append("items", toStr(strictPayload.items));
              postedKeys.push("items");
              form.append("no_of_items", toStr(strictPayload.items));
              postedKeys.push("no_of_items");
            }
            form.append(
              "booked_packet_order_id",
              toStr(strictPayload.booked_packet_order_id)
            );
            postedKeys.push("booked_packet_order_id");
            form.append(
              "special_instructions",
              toStr(strictPayload.special_instructions || "-")
            );
            postedKeys.push("special_instructions");
            // Remarks aliases to improve portal compatibility
            if (strictPayload.special_instructions) {
              const r = toStr(strictPayload.special_instructions);
              const remarkKeys = [
                "remarks",
                "Remarks",
                "instruction",
                "Instruction",
                "SpecialInstructions",
              ];
              for (const k of remarkKeys) {
                form.append(k, r);
                postedKeys.push(k);
              }
            }
            const prodVal =
              payload.product_description || payload.product_detail;
            if (prodVal) {
              const p = toStr(prodVal);
              // Base keys we know
              let keys = [
                "product_description",
                "booked_packet_product_detail",
                "product_detail",
                "product_details",
                "ProductDetail",
                "packet_description",
              ];
              // Extra variants
              const extras = [
                "product",
                "Product",
                "booked_packet_product",
                "booked_packet_product_description",
                "description",
                "item_description",
              ];
              keys = keys.concat(extras);
              // Prioritize env key if provided
              if (PRODUCT_KEY) {
                keys = [PRODUCT_KEY, ...keys.filter((k) => k !== PRODUCT_KEY)];
              }
              // In strict mode, send only the selected key
              if (PRODUCT_STRICT && PRODUCT_KEY) {
                keys = [PRODUCT_KEY];
              }
              const postedProdKeys = [];
              for (const k of keys) {
                form.append(k, p);
                postedProdKeys.push(k);
                postedKeys.push(k);
              }
              console.log(
                "[LCS][BOOK] product keys posted",
                postedProdKeys,
                "value=",
                p
              );
            }
            if (payload.custom_data) {
              form.append("custom_data", toStr(payload.custom_data));
              postedKeys.push("custom_data");
            }

            console.log(
              "[LCS][BOOK] field style",
              style,
              style === "snake" ? "(hybrid for shipper/consignee)" : ""
            );
            console.log(
              "[LCS][BOOK] productText",
              toStr(payload.product_description || payload.product_detail)
            );
            console.log(
              "[LCS][BOOK] shipment_id",
              process.env.LCS_OMIT_SHIPMENT_ID === "true"
                ? "(omitted by env flag)"
                : strictPayload.shipment_id === undefined
                ? "(omitted)"
                : toStr(strictPayload.shipment_id)
            );
            console.log("[LCS][BOOK] posting urlencoded keys", postedKeys);
            console.log("[LCS][BOOK] core values", {
              shipment_name: mask(strictPayload.ShipperName),
              shipment_phone: mask(local03),
              shipment_address: mask(strictPayload.ShipperAddress),
              consignee_name: mask(strictPayload.ConsigneeName),
              consignee_phone: mask(local03),
              consignee_address: mask(strictPayload.ConsigneeAddress),
            });
            console.log("[LCS][BOOK][REQ]", requestUrl);
            if (process.env.LCS_DEBUG_PAYLOAD === "true") {
              // Dump exact urlencoded payload: keys and values
              const debugMap = {};
              for (const k of postedKeys) {
                const vals = form.getAll(k);
                const masked =
                  k === "api_password"
                    ? "********"
                    : Array.isArray(vals)
                    ? vals.map((v) => v)
                    : form.get(k);
                debugMap[k] = masked;
              }
              console.log("[LCS][BOOK][REQ][URLENCODED_BODY]", debugMap);
            }
            apiRes = await axios.post(requestUrl, form.toString(), {
              timeout: 20000,
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
              },
            });
          } catch (e) {
            console.warn(
              "[LCS][BOOK] urlencoded request failed, will retry multipart",
              e?.message || e
            );
          }

        // Evaluate urlencoded response; if not success, retry with multipart
        let data = apiRes?.data;
        let needsMultipart =
          FORCE_MULTIPART || !data || Number(data?.status) !== 1;
        if (needsMultipart) {
          console.log(
            "[LCS][BOOK][RETRY] multipart due to",
            FORCE_MULTIPART
              ? "LCS_FORCE_MULTIPART=true"
              : "validation or request failure"
          );
          const FormDataPkg = require("form-data");
          const mform = new FormDataPkg();
          const mkeys = [];
          const toStr = (v) =>
            v === undefined || v === null ? "" : String(v).trim();
          // creds
          mform.append("api_key", toStr(strictPayload.api_key));
          mkeys.push("api_key");
          mform.append("api_password", toStr(strictPayload.api_password));
          mkeys.push("api_password");
          // shipper per docs
          if (strictPayload.ShipperName) {
            mform.append("shipment_name", toStr(strictPayload.ShipperName));
            mkeys.push("shipment_name");
            mform.append("shipment_name_eng", toStr(strictPayload.ShipperName));
            mkeys.push("shipment_name_eng");
          }
          if (strictPayload.ShipperPhone) {
            mform.append("shipment_phone", toStr(strictPayload.ShipperPhone));
            mkeys.push("shipment_phone");
          }
          if (strictPayload.ShipperAddress) {
            mform.append(
              "shipment_address",
              toStr(strictPayload.ShipperAddress)
            );
            mkeys.push("shipment_address");
          }
          // Shipper selection by ID (snake + variants)
          if (strictPayload.shipper_id) {
            mform.append("shipper_id", toStr(strictPayload.shipper_id));
            mkeys.push("shipper_id");
            mform.append("shipper_sys_id", toStr(strictPayload.shipper_id));
            mkeys.push("shipper_sys_id");
            mform.append("shipper_sysid", toStr(strictPayload.shipper_id));
            mkeys.push("shipper_sysid");
            mform.append("ShipperId", toStr(strictPayload.shipper_id));
            mkeys.push("ShipperId");
          }
          // consignee + consignment
          mform.append("consignee_name", toStr(strictPayload.ConsigneeName));
          mkeys.push("consignee_name");
          mform.append("consignment_name", toStr(strictPayload.ConsigneeName));
          mkeys.push("consignment_name");
          mform.append(
            "consignment_name_eng",
            toStr(strictPayload.ConsigneeName)
          );
          mkeys.push("consignment_name_eng");
          mform.append(
            "consignee_address",
            toStr(strictPayload.ConsigneeAddress)
          );
          mkeys.push("consignee_address");
          mform.append(
            "consignment_address",
            toStr(strictPayload.ConsigneeAddress)
          );
          mkeys.push("consignment_address");
          const rawF = String(strictPayload.ConsigneePhone || "").replace(
            /\D+/g,
            ""
          );
          const locF = rawF;
          const with92F = rawF.startsWith("92")
            ? rawF
            : rawF.startsWith("0")
            ? `92${rawF.slice(1)}`
            : rawF;
          mform.append("consignee_phone", toStr(locF));
          mkeys.push("consignee_phone");
          mform.append("consignee_mobile", toStr(with92F));
          mkeys.push("consignee_mobile");
          mform.append("consignment_phone", toStr(locF));
          mkeys.push("consignment_phone");
          mform.append("consignment_phone_two", toStr(with92F));
          mkeys.push("consignment_phone_two");
          // cities
          mform.append("origin_city", toStr(strictPayload.origin_city));
          mkeys.push("origin_city");
          mform.append(
            "destination_city",
            toStr(strictPayload.destination_city)
          );
          mkeys.push("destination_city");
          // parcel
          const allowShipmentIdRetry =
            process.env.LCS_OMIT_SHIPMENT_ID !== "true";
          if (allowShipmentIdRetry && strictPayload.shipment_id !== undefined) {
            mform.append("shipment_id", toStr(strictPayload.shipment_id));
            mkeys.push("shipment_id");
            mform.append("product_id", toStr(strictPayload.shipment_id));
            mkeys.push("product_id");
          }
          mform.append(
            "booked_packet_weight",
            toStr(payload.booked_packet_weight)
          );
          mkeys.push("booked_packet_weight");
          mform.append(
            "booked_packet_no_piece",
            toStr(payload.booked_packet_no_piece)
          );
          mkeys.push("booked_packet_no_piece");
          mform.append(
            "booked_packet_collect_amount",
            toStr(payload.booked_packet_collect_amount)
          );
          mkeys.push("booked_packet_collect_amount");
          // Booking type and service code
          if (strictPayload.booking_type_id) {
            mform.append(
              "booking_type_id",
              toStr(strictPayload.booking_type_id)
            );
            mkeys.push("booking_type_id");
          }
          if (strictPayload.service_code) {
            mform.append("service_code", toStr(strictPayload.service_code));
            mkeys.push("service_code");
          }
          if (strictPayload.shipment_type_id) {
            mform.append(
              "shipment_type_id",
              toStr(strictPayload.shipment_type_id)
            );
            mkeys.push("shipment_type_id");
          }
          if (strictPayload.booked_packet_option !== undefined) {
            mform.append(
              "booked_packet_option",
              toStr(strictPayload.booked_packet_option)
            );
            mkeys.push("booked_packet_option");
          }
          if (strictPayload.payment_type !== undefined) {
            mform.append("payment_type", toStr(strictPayload.payment_type));
            mkeys.push("payment_type");
          }
          if (strictPayload.allow_to_open !== undefined) {
            mform.append("allow_to_open", toStr(strictPayload.allow_to_open));
            mkeys.push("allow_to_open");
          }
          if (strictPayload.booked_packet_comments) {
            mform.append(
              "booked_packet_comments",
              toStr(strictPayload.booked_packet_comments)
            );
            mkeys.push("booked_packet_comments");
          }
          // Items aliases
          if (strictPayload.items) {
            mform.append("items", toStr(strictPayload.items));
            mkeys.push("items");
            mform.append("no_of_items", toStr(strictPayload.items));
            mkeys.push("no_of_items");
          }
          mform.append(
            "booked_packet_order_id",
            toStr(strictPayload.booked_packet_order_id)
          );
          mkeys.push("booked_packet_order_id");
          mform.append(
            "special_instructions",
            toStr(strictPayload.special_instructions || "-")
          );
          mkeys.push("special_instructions");
          if (strictPayload.special_instructions) {
            const r = toStr(strictPayload.special_instructions);
            const remarkKeys = [
              "remarks",
              "Remarks",
              "instruction",
              "Instruction",
              "SpecialInstructions",
            ];
            for (const k of remarkKeys) {
              mform.append(k, r);
              mkeys.push(k);
            }
          }
          const mProdVal =
            payload.product_description || payload.product_detail;
          if (mProdVal) {
            const p = toStr(mProdVal);
            let keys = [
              "product_description",
              "booked_packet_product_detail",
              "product_detail",
              "product_details",
              "ProductDetail",
              "packet_description",
            ];
            const extras = [
              "product",
              "Product",
              "booked_packet_product",
              "booked_packet_product_description",
              "description",
              "item_description",
            ];
            keys = keys.concat(extras);
            if (PRODUCT_KEY) {
              keys = [PRODUCT_KEY, ...keys.filter((k) => k !== PRODUCT_KEY)];
            }
            if (PRODUCT_STRICT && PRODUCT_KEY) {
              keys = [PRODUCT_KEY];
              // Minimal mirror: if strict to product_description, also append booked_packet_product_detail for compatibility
              if (PRODUCT_KEY === "product_description") {
                keys.push("booked_packet_product_detail");
              }
            }
            const postedProdKeys = [];
            for (const k of keys) {
              mform.append(k, p);
              postedProdKeys.push(k);
              mkeys.push(k);
            }
            console.log(
              "[LCS][BOOK][RETRY] product keys posted",
              postedProdKeys,
              "value=",
              p
            );
          }
          if (payload.custom_data) {
            mform.append("custom_data", toStr(payload.custom_data));
            mkeys.push("custom_data");
          }
          const headers = mform.getHeaders({ Accept: "application/json" });
          console.log("[LCS][BOOK][RETRY] multipart keys", mkeys);
          console.log(
            "[LCS][BOOK][RETRY] shipment_id",
            process.env.LCS_OMIT_SHIPMENT_ID === "true"
              ? "(omitted by env flag)"
              : strictPayload.shipment_id === undefined
              ? "(omitted)"
              : toStr(strictPayload.shipment_id)
          );
          console.log("[LCS][BOOK] content-type", headers["content-type"]);
          console.log("[LCS][BOOK][REQ][FALLBACK]", requestUrl);
          if (process.env.LCS_DEBUG_PAYLOAD === "true") {
            // Best-effort dump for multipart (form-data doesn't expose values easily)
            // Provide a synthetic map for critical fields we know
            const mdebug = {};
            const add = (k, v) => {
              mdebug[k] = k === "api_password" ? "********" : v;
            };
            add("api_key", strictPayload.api_key);
            add("api_password", strictPayload.api_password);
            add("shipment_name", strictPayload.ShipperName);
            add("shipment_phone", strictPayload.ShipperPhone);
            add("shipment_address", strictPayload.ShipperAddress);
            add("consignee_name", strictPayload.ConsigneeName);
            add("consignee_address", strictPayload.ConsigneeAddress);
            add("consignee_phone", String(strictPayload.ConsigneePhone || ""));
            add("origin_city", String(strictPayload.origin_city));
            add("destination_city", String(strictPayload.destination_city));
            if (strictPayload.shipment_id !== undefined)
              add("shipment_id", String(strictPayload.shipment_id));
            add("booked_packet_weight", String(payload.booked_packet_weight));
            add(
              "booked_packet_no_piece",
              String(payload.booked_packet_no_piece)
            );
            add(
              "booked_packet_collect_amount",
              String(payload.booked_packet_collect_amount)
            );
            add("booking_type_id", String(strictPayload.booking_type_id || ""));
            add("service_code", String(strictPayload.service_code || ""));
            add(
              "shipment_type_id",
              String(strictPayload.shipment_type_id || "")
            );
            add(
              "booked_packet_option",
              String(strictPayload.booked_packet_option || "")
            );
            add("payment_type", String(strictPayload.payment_type || ""));
            add("allow_to_open", String(strictPayload.allow_to_open || ""));
            add(
              "booked_packet_comments",
              String(strictPayload.booked_packet_comments || "")
            );
            add("items", String(strictPayload.items || ""));
            add(
              "booked_packet_order_id",
              String(strictPayload.booked_packet_order_id || "")
            );
            // Product keys (value already logged separately)
            for (const k of Array.isArray(mkeys) ? mkeys : []) {
              if (
                k.toLowerCase().includes("product") ||
                k.toLowerCase().includes("description") ||
                k.toLowerCase().includes("packet_description")
              ) {
                mdebug[k] = "(see value in product keys posted log)";
              }
            }
            // console.log('[LCS][BOOK][REQ][MULTIPART_BODY]', mdebug);
          }
          apiRes = await axios.post(requestUrl, mform, {
            timeout: 20000,
            headers,
          });
          data = apiRes?.data;
        }
        if (Number(data?.status) !== 1) {
          console.error("[LCS][RESP][FAIL]", {
            status: apiRes?.status,
            url: requestUrl,
            data,
          });
          const msg = data?.error || "LCS booking failed";
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        console.log("[LCS][RESP][OK]", data);

        // Persist shipping info
        order.shippingProvider = {
          provider: "lcs",
          pushed: true,
          trackingNumber: data?.track_number || data?.trackingNumber || "",
          consignmentNo: data?.track_number || "",
          labelUrl: data?.slip_link || null,
          extra: data,
          pushedAt: new Date(),
        };
        await order.save();

        results.push({
          orderId: order._id,
          ok: true,
          consignmentNo: order.shippingProvider.consignmentNo,
          trackingNumber: order.shippingProvider.trackingNumber,
          slip: order.shippingProvider.labelUrl,
        });
      } catch (err) {
        const apiError = err?.response?.data || err?.message || "Push failed";
        const httpStatus = err?.response?.status;
        const url = `${BASE_URL}bookPacket/format/json/`;
        results.push({
          orderId: order._id,
          ok: false,
          status: httpStatus,
          url,
          error: apiError,
        });
      }
    }

    return res.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("pushSelectedToLCS error", error);
    return res
      .status(500)
      .json({ message: "Failed to push orders to LCS", error: error?.message });
  }
};

// Add LCS tracking endpoint controller
async function trackLcsByCn(req, res) {
  try {
    const cn = String(req.params?.cn || req.query?.cn || req.body?.cn || '').trim();
    if (!cn) {
      return res.status(400).json({ message: "Consignment number is required" });
    }

    const LCS_BASE_URL = process.env.LCS_BASE_URL;
    const LCS_API_KEY = process.env.LCS_API_KEY;
    const LCS_API_PASSWORD = process.env.LCS_API_PASSWORD;
    const LCS_API_KEY_SECURE = process.env.LCS_API_KEY_SECURE || process.env.LCS_API_KEY; // optional, used by slip
    if (!LCS_BASE_URL || !LCS_API_KEY || !LCS_API_PASSWORD) {
      return res.status(400).json({
        message: 'LCS credentials not configured. Please set LCS_BASE_URL, LCS_API_KEY, LCS_API_PASSWORD in environment.'
      });
    }

    const BASE_URL = String(LCS_BASE_URL).endsWith('/') ? String(LCS_BASE_URL) : `${String(LCS_BASE_URL)}/`;
    const endpoints = [
      `${BASE_URL}trackBookedPacket/format/json/`,
      `${BASE_URL}trackPacket/format/json/`,
    ];

    // Build auth permutations
    const authVariants = [
      { api_key: LCS_API_KEY, api_password: LCS_API_PASSWORD },
      { api_key_secure: LCS_API_KEY_SECURE },
      {}, // some tenants allow unauthenticated tracking
    ];
    const buildBody = (auth, cnVal) => {
      const params = new URLSearchParams();
      if (auth.api_key) params.append('api_key', auth.api_key);
      if (auth.api_password) params.append('api_password', auth.api_password);
      if (auth.api_key_secure) params.append('api_key_secure', auth.api_key_secure);
      // CN aliases
      params.append('track_number', cnVal);
      params.append('tracknumber', cnVal);
      params.append('cn', cnVal);
      // Per docs, some tenants expect 'track_numbers' (plural), accepting single or comma-separated
      params.append('track_numbers', cnVal);
      return params;
    };

    const attempts = [];
    let data = null;
    // Try POST then GET across endpoints and auth variants
    outer: for (const url of endpoints) {
      for (const auth of authVariants) {
        // POST urlencoded
        try {
          const body = buildBody(auth, cn);
          const postRes = await axios.post(url, body.toString(), {
            timeout: 20000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          });
          attempts.push({ method: 'POST', url, auth: Object.keys(auth), ok: Number(postRes?.data?.status) === 1, note: postRes?.data?.error });
          if (Number(postRes?.data?.status) === 1) { data = postRes.data; break outer; }
        } catch (e) {
          attempts.push({ method: 'POST', url, auth: Object.keys(auth), ok: false, error: e?.message });
        }
        // GET query
        try {
          const params = buildBody(auth, cn);
          const getUrl = `${url}?${params.toString()}`;
          const getRes = await axios.get(getUrl, { timeout: 20000, headers: { Accept: 'application/json' } });
          attempts.push({ method: 'GET', url: getUrl, auth: Object.keys(auth), ok: Number(getRes?.data?.status) === 1, note: getRes?.data?.error });
          if (Number(getRes?.data?.status) === 1) { data = getRes.data; break outer; }
        } catch (e) {
          attempts.push({ method: 'GET', url, auth: Object.keys(auth), ok: false, error: e?.message });
        }
      }
    }
    if (!data || Number(data?.status) !== 1) {
      // Surface the specific error from LCS and our attempts (without secrets)
      return res.status(502).json({ message: data?.error || 'LCS tracking failed', data, attempts });
    }

    // Normalize result
    const raw = data;
    // Some tenants return tracking details under different keys
    let detailList = [];
    if (Array.isArray(raw?.booked_packet_tracking_detail)) {
      detailList = raw.booked_packet_tracking_detail;
    } else if (Array.isArray(raw?.['Tracking Detail'])) {
      detailList = raw['Tracking Detail'];
    } else if (Array.isArray(raw?.tracking_detail)) {
      detailList = raw.tracking_detail;
    }

    const events = detailList.map((e) => ({
      date: e?.date || e?.Date || e?.datetime || null,
      status: e?.status || e?.Status || e?.message || null,
      origin: e?.origin_city || e?.Origin || null,
      destination: e?.destination_city || e?.Destination || null,
      remarks: e?.remarks || e?.Remarks || null,
    }));

    let statusText = null;
    // Prefer latest event when available
    const latest = events[events.length - 1] || null;
    if (latest?.status) statusText = latest.status;

    // Fallbacks from packet_list
    const pkt = Array.isArray(raw?.packet_list) ? raw.packet_list[0] : null;
    if (!statusText) statusText = pkt?.booked_packet_status || pkt?.title || raw?.booked_packet_status || raw?.Status || null;

    const normalized = {
      cn,
      status: statusText || 'Unknown',
      currentCity: raw?.current_city || pkt?.origin_city_name || latest?.origin || null,
      lastEventAt: latest?.date || pkt?.booking_date || null,
      events,
    };

    return res.json({ ok: true, data: normalized, raw });
  } catch (error) {
    console.error("trackLcsByCn error", error);
    return res
      .status(500)
      .json({ message: "Failed to track LCS order", error: error?.message });
  }
}

module.exports = {
  pushSelectedToLCS,
  trackLcsByCn,
};

// Admin endpoint: resolve an order's LCS city manually
async function resolveOrderLcsCity(req, res) {
  try {
    const { orderId, lcsCityId, lcsCityName } = req.body || {};
    if (!orderId || !lcsCityId) {
      return res.status(400).json({ message: 'orderId and lcsCityId are required' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.shippingProvider = order.shippingProvider || {};
    order.shippingProvider.extra = Object.assign({}, order.shippingProvider.extra, {
      lcsResolution: {
        ...(order.shippingProvider.extra?.lcsResolution || {}),
        id: lcsCityId,
        name: lcsCityName || null,
        method: 'manual',
        confidence: 1.0,
        resolvedAt: new Date(),
      }
    });
    await order.save();
    return res.json({ ok: true, orderId, lcsCityId, lcsCityName });
  } catch (e) {
    console.error('resolveOrderLcsCity error', e);
    return res.status(500).json({ message: 'Failed to resolve order city', error: e?.message });
  }
}

module.exports.resolveOrderLcsCity = resolveOrderLcsCity;

// Admin endpoint: get LCS city suggestions by query
async function listLcsCitySuggestions(req, res) {
  try {
    const q = req.query?.q || req.body?.q || '';
    if (!q || String(q).trim().length < 2) {
      return res.json({ ok: true, data: [] });
    }
    const out = await suggestCities(q, Number(req.query?.limit || 10));
    return res.json({ ok: true, data: out });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch LCS city suggestions', error: e?.message });
  }
}

module.exports.listLcsCitySuggestions = listLcsCitySuggestions;

// Admin endpoint: list all LCS cities (cached)
async function listAllLcsCities(req, res) {
  try {
    const cities = await getCities(Boolean(req.query?.force === 'true'));
    return res.json({ ok: true, data: cities });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch LCS cities', error: e?.message });
  }
}

module.exports.listAllLcsCities = listAllLcsCities;
