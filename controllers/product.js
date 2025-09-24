const Product = require('../models/product');
const { uploadImage , deleteImage } = require('../config/cloudinary');
const Category = require('../models/category');
const Brand = require('../models/brand');
const cloudinary = require('cloudinary').v2
const Tag = require('../models/tag.js');
const { default: mongoose } = require('mongoose');
const slugify = require('slugify');
const SubCategory = require('../models/subCategory.js');
const Redirect = require('../models/redirect'); // Centralized Redirect model

const frontendBase = process.env.BASE_URL || 'http://localhost:5173'; 

const generateSlug = (title, providedSlug) => {
    if (providedSlug !== undefined && providedSlug !== null && providedSlug !== "") {
        const decoded = decodeURIComponent(String(providedSlug));
        return slugify(decoded, { lower: true, strict: true });
    } else if (providedSlug === "") {
        return null;
    } else {
        return slugify(String(title), { lower: true, strict: true });
    }
};

// Process volume tiers: expects array of { quantity, price, imageIndex? }
const processVolumeTiers = async (tiers = [], tierImages) => {
    const processed = [];
    for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        const idx = t.imageIndex !== undefined && t.imageIndex !== null ? Number(t.imageIndex) : null;
        let imageUrl = null;
        if (tierImages && idx !== null && tierImages[idx]) {
            const uploaded = await uploadImage(tierImages[idx]);
            imageUrl = uploaded.url;
        }
        processed.push({
            quantity: Number(t.quantity),
            price: Number(t.price),
            ...(imageUrl ? { image: imageUrl } : {}),
        });
    }
    return processed;
};


const createProduct = async (req, res) => {
    try {
        const {
            title,
            description,
            longDescription,
            price,
            salePrice,
            weight,
            categories,
            subCategory,
            stock,
            brand,
            variants,
            freeShipping,
            tags,
            slug,
            imageAlts,
            metaDescription,
            volumeTierEnabled,
            volumeTiers
        } = req.body;

        console.log("Coming data----->", req.body)
        console.log("Raw slug from req.body (createProduct):", slug);

        // Validate required fields
        if (!title || !description || !price || !categories || !stock || !req.files.images) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Parse and validate variants
        let parsedVariants;
        try {
            parsedVariants = JSON.parse(variants);
        } catch (error) {
            return res.status(400).json({ message: "Invalid variant data format." });
        }

        // Parse volume tiers (optional)
        let parsedVolumeTiers = [];
        if (volumeTiers) {
            try {
                parsedVolumeTiers = JSON.parse(volumeTiers);
            } catch (error) {
                return res.status(400).json({ message: "Invalid volume tiers data format." });
            }
        }

        console.log("Parsed varianst----->", parsedVariants)
        // Validate tags
        const tagsArray = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
        if (!tagsArray || tagsArray.length === 0) {
            return res.status(400).json({ message: "Tags are required." });
        }

        // Add 'new' tag to new products
        if (!tagsArray.includes('new')) {
            tagsArray.push('new');
        }

        // Parse and validate categories
        let parsedCategories;
        try {
            parsedCategories = Array.isArray(categories) ? categories : JSON.parse(categories);
        } catch (error) {
            return res.status(400).json({ message: "Invalid categories data format." });
        }

        // Validate categories and subcategory
        const categoryDocs = await validateCategories(parsedCategories);
        const subCategoryDoc = await validateSubCategory(subCategory);
        const brandDoc = brand ? await validateBrand(brand) : null;

        if (!brandDoc) return res.status(400).json({ message: "Invalid brand." });
        if (!categoryDocs || categoryDocs.length === 0) {
            return res.status(400).json({ message: "At least one valid category is required." });
        }

        // Process tags
        const tagIds = await processTags(tagsArray);

        // Upload images
        const uploadedImages = await uploadImages(req.files.images);

        // Process variants
        const uploadedVariants = await processVariants(parsedVariants, req.files.variantImages);

        // Process volume tiers
        const uploadedVolumeTiers = await processVolumeTiers(parsedVolumeTiers, req.files?.volumeTierImages);

        // **Handle Free Shipping & Delivery Charges**
        const isFreeShipping = freeShipping === 'true' || freeShipping === true;
        const isVolumeTierEnabled = volumeTierEnabled === 'true' || volumeTierEnabled === true;
        const deliveryCharges = isFreeShipping ? 0 : 250;
        // Create product
        const currentUserId = req.user.id;
        const newProduct = new Product({
            title,
            description,
            longDescription,
            metaDescription,
            price,
            slug: generateSlug(title, slug),
            salePrice,
            weight,
            categories: categoryDocs.map(cat => cat._id),
            subCategory: subCategoryDoc?._id || null,
            stock,
            sold: 0,
            brand: brandDoc._id || null,
            tags: tagIds,
            variants: uploadedVariants,
            volumeTierEnabled: isVolumeTierEnabled,
            volumeTiers: uploadedVolumeTiers,
            images: uploadedImages,
            freeShipping: isFreeShipping,
            deliveryCharges,
            creator: currentUserId,
        });

        console.log("Final slug after slugify (createProduct):", newProduct.slug);

        await newProduct.save();
        console.log("New product in db----->", newProduct)

        res.status(201).json({
            message: 'Product created successfully',
            product: newProduct,
        });
    } catch (error) {
        console.error("Error in create product:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
// Helper functions
const validateCategory = async (category) => {
    const categoryDoc = await Category.findOne({ name: category.toLowerCase() });
    return categoryDoc;
};

const validateCategories = async (categories) => {
    const categoryDocs = [];
    for (const categoryName of categories) {
        const categoryDoc = await Category.findOne({ name: categoryName.toLowerCase() });
        if (categoryDoc) {
            categoryDocs.push(categoryDoc);
        }
    }
    return categoryDocs;
};

const validateBrand = async (brand) => {
    const brandDoc = await Brand.findOne({ name: brand.toLowerCase() });
    return brandDoc;
};

const validateSubCategory = async (subCategory) => {
    if (!subCategory) return null;
    const subCategoryDoc = await SubCategory.findOne({ name: subCategory.toLowerCase() });
    return subCategoryDoc;
};

const processTags = async (tagsArray) => {
    const tagIds = [];
    for (const tagName of tagsArray) {
        const tagNameLower = tagName.toLowerCase();
        let tag = await Tag.findOne({ name: tagNameLower });


        tagIds.push(tag._id);
    }
    return tagIds;
};

// Update uploadImages to return array of { url, public_id }
const uploadImages = async (images) => {
    const uploadedImages = [];
    for (const file of images) {
        const uploadedImage = await uploadImage(file);
        uploadedImages.push({ url: uploadedImage.url, public_id: uploadedImage.public_id });
    }
    return uploadedImages;
};

const processVariants = async (variants, variantImages) => {
    const groupedVariants = {};

    // Group variants by name
    variants.forEach((variant) => {
        if (!groupedVariants[variant.name]) {
            groupedVariants[variant.name] = [];
        }
        groupedVariants[variant.name].push({
            value: variant.value,
            price: variant.price ?? null,
            imageIndex: variant.imageIndex ?? null,
        });
    });

    const uploadedVariants = [];

    for (const [variantName, values] of Object.entries(groupedVariants)) {
        const processedValues = [];

        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            const variantImageFile = variantImages ? variantImages[value.imageIndex] : null;

            if (variantImageFile) {
                const uploadedImage = await uploadImage(variantImageFile);
                processedValues.push({
                    value: value.value,
                    price: value.price,
                    image: uploadedImage.url, // Assign the uploaded image URL
                });
            } else {
                processedValues.push({
                    value: value.value,
                    price: value.price,
                });
            }
        }

        uploadedVariants.push({
            name: variantName,
            values: processedValues,
        });
    }

    return uploadedVariants;
};

const updateProduct = async (req, res) => {
    try {
        const { slug: paramSlug } = req.params;
        const {
            title,
            description,
            longDescription,
            price,
            salePrice,
            weight,
            categories,
            subCategory,
            stock,
            brand,
            variants,
            tags,
            existingImages,
            slug,
            metaDescription,
            specialOfferEnabled,
            specialOfferPrice,
            specialOfferStart,
            specialOfferEnd,
            volumeTierEnabled,
            volumeTiers,
        } = req.body;

        console.log("categories from frontend:", categories, "subCategory from frontend:", subCategory);
        console.log("Coming data in update controller from frontend------>", req.body)
        console.log("Raw slug from req.body (updateProduct):", slug);
        console.log("subCategory field in request body:", req.body.subCategory);
        console.log("variantImages received:", req.files?.variantImages);

        const product = await Product.findOne({ slug: paramSlug });
        if (!product) return res.status(404).json({ message: "Product not found." });

        const parsedVariants = variants ? JSON.parse(variants) : null;
        const parsedVolumeTiers = volumeTiers ? JSON.parse(volumeTiers) : null;

        if (title !== undefined) {
            product.title = title;
        }

        // Handle optional slug update
        if (slug !== undefined) {
            const oldSlug = product.slug;
            const newSlug = generateSlug(title, slug); // Pass title for fallback in case of empty slug
            if (oldSlug && oldSlug !== newSlug) {
                // Always redirect to category page
                let redirectTo = '/';
                if (product.categories && product.categories.length > 0) {
                    const cat = await Category.findById(product.categories[0]);
                    if (cat && cat.slug) {
                        redirectTo = `/category/${cat.slug}`;
                    }
                }
                await Redirect.create({ from: oldSlug, to: redirectTo, type: 'product' });
            }
            product.slug = newSlug;
            console.log("Final slug after slugify (updateProduct):", product.slug);
        }

        let tagIds = [];
        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
            tagIds = await processTags(tagsArray);
            product.tags = tagIds;
        }

        // CATEGORIES
        if (categories && categories !== "") {
            let parsedCategories;
            try {
                parsedCategories = Array.isArray(categories) ? categories : JSON.parse(categories);
            } catch (error) {
                return res.status(400).json({ message: "Invalid categories data format." });
            }

            const categoryDocs = await validateCategories(parsedCategories);
            if (!categoryDocs || categoryDocs.length === 0) {
                return res.status(400).json({ message: "At least one valid category is required." });
            }
            product.categories = categoryDocs.map(cat => cat._id);
        }

        // Handle brand
        let brandId = product.brand;
        if (brand) {
            let brandData;
            try {
                brandData = typeof brand === 'string' ? JSON.parse(brand) : brand;
            } catch (error) {
                brandData = brand;
            }

            if (typeof brandData === 'object' && brandData._id) {
                brandId = brandData._id;
            } else if (typeof brandData === 'string') {
                const brandObj = await Brand.findOne({ name: brandData.toLowerCase() });
                if (!brandObj) {
                    return res.status(400).json({ message: "Brand not found." });
                }
                brandId = brandObj._id;
            }
        }

        // SUBCATEGORY
        if (subCategory && subCategory !== "") {
            if (mongoose.Types.ObjectId.isValid(subCategory)) {
                const subCategoryObj = await SubCategory.findById(subCategory);
                if (!subCategoryObj) {
                    return res.status(400).json({ message: "SubCategory not found for ID: " + subCategory });
                }
                product.subCategory = subCategoryObj._id;
            } else {
                return res.status(400).json({ message: "Invalid subCategory ID format." });
            }
        }

        // Handling the images update
        let updatedImages = [];
        if (existingImages) {
            // Parse and preserve existing images (now objects)
            updatedImages = [...JSON.parse(existingImages)];
        }
        if (req.files?.images && req.files.images.length > 0) {
            // Append the new images to the existing ones
            for (const file of req.files.images) {
                const myImage = await uploadImage(file);
                updatedImages.push({ url: myImage.url, public_id: myImage.public_id });
            }
        }

        // --- VARIANT IMAGE HANDLING (robust, preserve existing images) ---
        let variantImageMap = {};
        if (req.files?.variantImages && req.files.variantImages.length > 0) {
            for (const file of req.files.variantImages) {
                const parts = file.originalname.split('-');
                const variantValue = parts.slice(1, parts.length - 1).join('-').replace(/\.[^/.]+$/, '').toLowerCase();
                const uploadedImage = await uploadImage(file);
                variantImageMap[variantValue] = uploadedImage.url;
                console.log('Mapping variant value:', variantValue, 'to Cloudinary URL:', uploadedImage.url);
            }
        }

        let updatedVariants = [];
        if (parsedVariants) {
            console.log("Processing variants update with parsedVariants:", parsedVariants);
            console.log("Existing product variants:", product.variants);
            
            updatedVariants = parsedVariants.map(newVariant => {
                // Find the existing variant in the DB (by name)
                const existingVariant = product.variants.find(v => v.name === newVariant.name);
                console.log(`Processing variant "${newVariant.name}", existing variant:`, existingVariant);
                
                return {
                    ...newVariant,
                    values: newVariant.values.map(val => {
                        console.log(`Processing variant value "${val.value}" with image:`, val.image);
                        
                        // Try to get the Cloudinary URL for this value (new upload)
                        const key = val.value.toLowerCase();
                        if (variantImageMap[key]) {
                            console.log(`Found new uploaded image for "${val.value}":`, variantImageMap[key]);
                            return { ...val, image: variantImageMap[key] };
                        }
                        
                        // If no new image uploaded, preserve the existing image from DB
                        if (existingVariant) {
                            const existingValue = existingVariant.values.find(ev => ev.value === val.value);
                            if (existingValue && existingValue.image) {
                                console.log(`Preserving existing image for "${val.value}":`, existingValue.image);
                                return { ...val, image: existingValue.image };
                            }
                        }
                        
                        // If no existing image found, keep the image as is (don't set to null)
                        console.log(`No image found for "${val.value}", keeping as is:`, val.image);
                        return val;
                    })
                };
            });
        } else {
            // If no variants are being updated, keep the existing variants as they are
            console.log("No variants update, preserving existing variants:", product.variants);
            updatedVariants = [...product.variants];
        }

        // --- VOLUME TIERS IMAGE HANDLING (preserve existing images) ---
        let updatedVolumeTiers = [];
        if (parsedVolumeTiers) {
            // If new images are sent as an array aligned by imageIndex
            const tierImages = req.files?.volumeTierImages || null;
            updatedVolumeTiers = [];
            for (let i = 0; i < parsedVolumeTiers.length; i++) {
                const t = parsedVolumeTiers[i];
                let imageUrl = t.image || null;
                const idx = t.imageIndex !== undefined && t.imageIndex !== null ? Number(t.imageIndex) : null;
                if (tierImages && idx !== null && tierImages[idx]) {
                    const uploaded = await uploadImage(tierImages[idx]);
                    imageUrl = uploaded.url;
                } else if (!imageUrl && Array.isArray(product.volumeTiers)) {
                    // Try to preserve from existing by matching quantity and price
                    const existing = product.volumeTiers.find(et => Number(et.quantity) === Number(t.quantity) && Number(et.price) === Number(t.price));
                    if (existing && existing.image) imageUrl = existing.image;
                }
                updatedVolumeTiers.push({
                    quantity: Number(t.quantity),
                    price: Number(t.price),
                    ...(imageUrl ? { image: imageUrl } : {}),
                });
            }
        } else {
            updatedVolumeTiers = Array.isArray(product.volumeTiers) ? [...product.volumeTiers] : [];
        }

        // Handle the deletion of variants (if any)
        if (req.body.deleteVariants) {
            const variantsToDelete = req.body.deleteVariants.split(',');
            updatedVariants = updatedVariants.filter(variant =>
                !variantsToDelete.includes(variant.value)
            );
        }

        // Handle Free Shipping & Delivery Charges
        if (req.body.freeShipping !== undefined) {
            const isFreeShipping = req.body.freeShipping === 'true' || req.body.freeShipping === true;
            product.freeShipping = isFreeShipping;
            product.deliveryCharges = isFreeShipping ? 0 : 250;
        }

        // Update volume tier enabled flag
        if (volumeTierEnabled !== undefined) {
            product.volumeTierEnabled = volumeTierEnabled === 'true' || volumeTierEnabled === true;
        }

        // Update special offer fields if provided
        if (specialOfferEnabled === 'true' || specialOfferEnabled === true) {
            if (specialOfferStart !== undefined) {
                const startDate = new Date(specialOfferStart);
                product.specialOfferStart = isNaN(startDate.getTime()) ? null : startDate;
            }
            if (specialOfferEnd !== undefined) {
                const endDate = new Date(specialOfferEnd);
                product.specialOfferEnd = isNaN(endDate.getTime()) ? null : endDate;
            }
            if (specialOfferPrice !== undefined) {
                product.specialOfferPrice = specialOfferPrice;
            }
            product.specialOfferEnabled = true;
        } else {
            product.specialOfferEnabled = false;
            product.specialOfferStart = null;
            product.specialOfferEnd = null;
            product.specialOfferPrice = null;
        }

        product.title = title || product.title;
        product.description = description || product.description;
        product.longDescription = longDescription || product.longDescription
        product.price = price || product.price;
        product.salePrice = salePrice === 'null' ? null : salePrice || product.salePrice;
        product.weight = weight || product.weight;
        product.brand = brandId;
        product.tags = tagIds.length > 0 ? tagIds : product.tags;
        product.images = updatedImages;
        product.variants = updatedVariants;
        product.volumeTiers = updatedVolumeTiers;
        product.metaDescription = metaDescription || product.metaDescription;

        await product.save();

        console.log("Updated product------------->", product);

        res.status(200).json({
            message: "Product updated successfully.",
            product
        });
    } catch (error) {
        res.status(500).json({ message: "Internal server error." });
        console.log("Error in updating product:", error)
    }
};

const getAllProducts = async (req, res) => {
    try {
        // Convert page and limit to numbers and provide defaults
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 8;
        
        // Ensure limit is at least 1 and not too high
        const safeLimit = Math.min(Math.max(1, limit), 50);
        
        const skip = (page - 1) * safeLimit;
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / safeLimit);

        const products = await Product.find({})
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText createdAt',
                populate: {
                    path: 'reviewerId', // Populate reviewer details
                    select: 'username email'
                }
            })
            .sort([['createdAt', 'desc']])
            .skip(skip)
            .limit(safeLimit);

        // Calculate average rating for each product and add it to the product object
        products.forEach(product => {
            const totalRating = product.reviews.reduce((acc, review) => acc + review.rating, 0);
            const averageRating = product.reviews.length > 0 ? totalRating / product.reviews.length : 0;
            product.averageRating = averageRating;
        });

        res.status(200).json({
            success: true,
            message: 'Products fetched successfully',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products
        });
    } catch (error) {
        console.error("Error in fetching all products", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// GET product by slug, with centralized redirect support
const getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        // Try to find the product by current slug
        let product = await Product.findOne({ slug })
            .populate('categories', 'name slug')
            .populate('subCategory', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name slug' )
            .populate({
                path: 'reviews',
                select: 'rating reviewText createdAt',
                populate: {
                    path: 'reviewerId',
                    select: 'username email'
                }
            });

        if (product) {
            // Found by current slug, return as usual
            const totalRating = product.reviews.reduce((acc, review) => acc + review.rating, 0);
            const averageRating = product.reviews.length > 0 ? totalRating / product.reviews.length : 0;
            product.averageRating = averageRating;
            await product.save();
            return res.status(200).json({
                success: true,
                message: 'Product fetched successfully',
                product,
                averageRating
            });
        }

        // Not found: check centralized Redirect collection
        const redirect = await Redirect.findOne({ from: slug });
        if (redirect) {
            redirect.count += 1;
            await redirect.save();
            // Use absolute URL for redirect (fixes SPA asset 404 issue)
            return res.redirect(301, `${frontendBase}${redirect.to}`);
        }

        // Not found at all
        return res.status(404).json({ message: "Product not found." });
    } catch (error) {
        console.error("Error in fetching product by slug", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Product id being deleting------->", id)
        const product = await Product.findById(id)
        if (!product)
            return res.status(404).json({ message: "Invalid product Id" })

        // Add redirect for the current slug to the parent category (or home if not available)
        let redirectTo = '/';
        if (product.categories && product.categories.length > 0) {
            const cat = await Category.findById(product.categories[0]);
            if (cat && cat.slug) {
                redirectTo = `/category/${cat.slug}`;
            }
        }
        await Redirect.deleteMany({ from: product.slug });
        await Redirect.create({ from: product.slug, to: redirectTo, type: 'product' });

        // Optionally, add redirects for any old slugs (if you were tracking them elsewhere)

        if (product.images && product.images.length > 0) {
            for (const imageObj of product.images) {
                if (imageObj.public_id) {
                    await deleteImage(imageObj.public_id);
                }
            }
        }


        const deletedProduct = await Product.findByIdAndDelete(id)


        res.status(200).json({
            success: true,
            message: "Product deleted.",
            deletedProduct,
        })

    } catch (error) {
        console.log("Error in deleting product", error)
        res.status(500).json({ message: "Internal sever error" })
    }
}

const getMyProducts = async (req, res) => {
    try {
        const products = await Product.find({ creator: req.user.id })
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .sort({ createdAt: -1 })

        res.status(200).json({
            success: true,
            message: "Your products fetched successfully",
            products
        });
    } catch (error) {
        console.error("Error in fetching products:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getRelatedProducts = async (req, res) => {
    try {
        const { categoryId, excludeProductId } = req.params;
        const { page = 1, limit = 8 } = req.query;

        const skip = (page - 1) * limit;

        const objectedCategoryId = new mongoose.Types.ObjectId(categoryId);

        // Fetch related products based on category
        let relatedProducts = await Product.find({
            categories: categoryId,
            _id: { $ne: excludeProductId }
        })
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .skip(skip)
            .limit(limit)
            .sort([['createdAt', 'desc']]);

        // If no related products are found, fetch random products
        if (relatedProducts.length === 0) {
            relatedProducts = await Product.aggregate([
                { $match: { _id: { $ne: new mongoose.Types.ObjectId(excludeProductId) } } },
                { $sample: { size: Number(limit) } }
            ]);

            relatedProducts = await Product.populate(relatedProducts, [
                { path: 'categories', select: 'name slug' },
                { path: 'tags', select: 'name' }
            ]);
        }

        const totalProducts = await Product.countDocuments({
            categories: objectedCategoryId,
            _id: { $ne: excludeProductId }
        });

        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            success: true,
            message: relatedProducts.length > 0 ? 'Related products fetched successfully' : 'No related products found, showing random products',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products: relatedProducts
        });
    } catch (error) {
        console.error("Error in fetching related products:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getBestSellers = async (req, res) => {
    try {
        // Safely parse pagination params
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 4;
        const safeLimit = Math.min(Math.max(1, limit), 50);
        const skip = (page - 1) * safeLimit;

        // Find the 'best seller' tag (case-insensitive)
        const bestSellerTag = await Tag.findOne({ name: /^best seller$/i });
        if (!bestSellerTag) {
            return res.status(200).json({
                success: true,
                message: 'No best seller tag found',
                products: [],
                currentPage: 1,
                totalPages: 0,
                totalProducts: 0
            });
        }

        const totalProducts = await Product.countDocuments({
            tags: { $in: [bestSellerTag._id] }
        });
        const totalPages = Math.ceil(totalProducts / safeLimit);

        const products = await Product.find({ tags: { $in: [bestSellerTag._id] } })
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText createdAt',
                populate: {
                    path: 'reviewerId',
                    select: 'username email'
                }
            })
            .skip(skip)
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']])
            .limit(safeLimit);

        // Calculate average rating for each product
        products.forEach(product => {
            const totalRating = product.reviews.reduce((acc, review) => acc + review.rating, 0);
            product.averageRating = product.reviews.length > 0 ?
                totalRating / product.reviews.length : 0;
        });

        res.status(200).json({
            success: true,
            message: 'Best seller products fetched successfully',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products
        });
    } catch (error) {
        console.error('Error fetching best-selling products:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const getProductsBySubCategory = async (req, res) => {
    try {
        const { subCategory } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log("coming query params in subcategory controller------->", req.query)
        const subCategoryDoc = await SubCategory.findOne({ slug: subCategory });
        if (!subCategoryDoc) {
            return res.status(404).json({ message: "Subcategory not found." });
        }

        const totalProducts = await Product.countDocuments({ subCategory: subCategoryDoc._id });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ subCategory: subCategoryDoc._id })
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText createdAt',
                populate: {
                    path: 'reviewerId',
                    select: 'username email'
                }
            })
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']])
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            message: 'Products fetched successfully',
            products,
            totalProducts,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Error in fetching products by subcategory", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getFeaturedProducts = async (req, res) => {
    try {
        // Convert page and limit to numbers and provide defaults
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 8;
        
        // Ensure limit is at least 1 and not too high
        const safeLimit = Math.min(Math.max(1, limit), 50);
        
        const skip = (page - 1) * safeLimit;

        // Find the 'featured' tag (case-insensitive for robustness)
        const featuredTag = await Tag.findOne({ name: /^featured$/i });
        if (!featuredTag) {
            return res.status(200).json({
                success: true,
                message: 'No featured tag found',
                products: [],
                currentPage: 1,
                totalPages: 0,
                totalProducts: 0
            });
        }

        // Only fetch products that have the 'featured' tag
        const totalProducts = await Product.countDocuments({
            tags: { $in: [featuredTag._id] }
        });
        const totalPages = Math.ceil(totalProducts / safeLimit);

        const products = await Product.find({ tags: { $in: [featuredTag._id] } })
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText createdAt',
                populate: {
                    path: 'reviewerId',
                    select: 'username email'
                }
            })
            .skip(skip)
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']])
            .limit(safeLimit);

        // Calculate average rating for each product
        products.forEach(product => {
            const totalRating = product.reviews.reduce((acc, review) => acc + review.rating, 0);
            product.averageRating = product.reviews.length > 0 ?
                totalRating / product.reviews.length : 0;
        });

        res.status(200).json({
            success: true,
            message: 'Featured products fetched successfully',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products
        });
    } catch (error) {
        console.error("Error in fetching featured products", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getNewArrivals = async (req, res) => {
    try {
        const { page = 1, limit = 8 } = req.query;
        const skip = (page - 1) * limit;

        // Find the 'new' tag (case-insensitive)
        const newTag = await Tag.findOne({ name: /^new$/i });
        if (!newTag) {
            return res.status(200).json({
                success: true,
                message: 'No new tag found',
                products: [],
                currentPage: 1,
                totalPages: 0,
                totalProducts: 0
            });
        }

        const totalProducts = await Product.countDocuments({
            tags: { $in: [newTag._id] }
        });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ tags: { $in: [newTag._id] } })
            .populate('categories', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText createdAt',
                populate: {
                    path: 'reviewerId',
                    select: 'username email'
                }
            })
            .skip(skip)
            .sort({ createdAt: -1 })
            .limit(limit);

        // Calculate average rating for each product
        products.forEach(product => {
            const totalRating = product.reviews.reduce((acc, review) => acc + review.rating, 0);
            product.averageRating = product.reviews.length > 0 ?
                totalRating / product.reviews.length : 0;
        });

        res.status(200).json({
            success: true,
            message: 'New arrival products fetched successfully',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products
        });
    } catch (error) {
        console.error('Error fetching new arrival products:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Upload image for long description (Quill)
const uploadDescriptionImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided.' });
        }
        const uploaded = await uploadImage(req.file);
        return res.status(200).json({ url: uploaded.url });
    } catch (error) {
        console.error('Error uploading description image:', error);
        return res.status(500).json({ message: 'Failed to upload image.' });
    }
};

module.exports = {
    createProduct,
    getProductBySlug,
    updateProduct,
    getAllProducts,
    deleteProduct,
    getMyProducts,
    getRelatedProducts,
    getBestSellers,
    getProductsBySubCategory,
    getFeaturedProducts,
    getNewArrivals,
    uploadDescriptionImage, // <-- export new controller
};
