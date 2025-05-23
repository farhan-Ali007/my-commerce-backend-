const Product = require('../models/product');
const { uploadImage } = require('../config/cloudinary');
const Category = require('../models/category');
const Brand = require('../models/brand');
const cloudinary = require('cloudinary').v2
const Tag = require('../models/tag.js');
const { default: mongoose } = require('mongoose');
const slugify = require('slugify');
const SubCategory = require('../models/subCategory.js');

const createProduct = async (req, res) => {
    try {
        const {
            title,
            description,
            longDescription,
            price,
            salePrice,
            weight,
            category,
            subCategory,
            stock,
            brand,
            variants,
            freeShipping,
            tags,
        } = req.body;

        console.log("Coming data----->", req.body)

        // Validate required fields
        if (!title || !description || !price || !category || !stock || !req.files.images) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Generate slug
        let slug = slugify(title, { lower: true, strict: true });
        let existingProduct = await Product.findOne({ slug });
        if (existingProduct) {
            slug = `${slug}-${Date.now()}`;
        }

        // Parse and validate variants
        let parsedVariants;
        try {
            parsedVariants = JSON.parse(variants);
        } catch (error) {
            return res.status(400).json({ message: "Invalid variant data format." });
        }

        console.log("Parsed varianst----->", parsedVariants)
        // Validate tags
        const tagsArray = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
        if (!tagsArray || tagsArray.length === 0) {
            return res.status(400).json({ message: "Tags are required." });
        }

        // Validate category and subcategory
        const categoryDoc = await validateCategory(category);
        const subCategoryDoc = await validateSubCategory(subCategory);
        const brandDoc = brand ? await validateBrand(brand) : null;

        if (!brandDoc) return res.status(400).json({ message: "Invalid brand." });
        if (!categoryDoc) {
            return res.status(400).json({ message: "Invalid category or subcategory." });
        }

        // Process tags
        const tagIds = await processTags(tagsArray);

        // Upload images
        const uploadedImages = await uploadImages(req.files.images);

        // Process variants
        const uploadedVariants = await processVariants(parsedVariants, req.files.variantImages);

        // **Handle Free Shipping & Delivery Charges**
        const isFreeShipping = freeShipping === 'true' || freeShipping === true;
        const deliveryCharges = isFreeShipping ? 0 : 200;
        // Create product
        const currentUserId = req.user.id;
        const newProduct = new Product({
            title,
            description,
            longDescription,
            price,
            slug,
            salePrice,
            weight,
            category: categoryDoc._id,
            subCategory: subCategoryDoc?._id || null,
            stock,
            sold: 0,
            brand: brandDoc._id || null,
            tags: tagIds,
            variants: uploadedVariants,
            images: uploadedImages,
            freeShipping: isFreeShipping,
            deliveryCharges,
            creator: currentUserId,
        });

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

        if (!tag) {
            tag = new Tag({ name: tagNameLower });
            await tag.save();
        }

        tagIds.push(tag._id);
    }
    return tagIds;
};

const uploadImages = async (images) => {
    const uploadedImages = [];
    for (const file of images) {
        const uploadedImage = await uploadImage(file);
        uploadedImages.push(uploadedImage.url);
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
        const { slug } = req.params;
        const {
            title,
            description,
            longDescription,
            price,
            salePrice,
            weight,
            category,
            subCategory,
            stock,
            brand,
            variants,
            tags,
            existingImages
        } = req.body;

        // console.log("coming slug in update controller ------>", slug);
        console.log("Coming data in update controller from frontend------>", req.body)
        console.log("subCategory field in request body:", req.body.subCategory);
        // console.log("coming variants in update controller from frontend ------->", variants)
        // console.log("coming category typeof in update controller from frontend ------->", typeof category)
        // console.log("coming subcategory in update controller from frontend ------->", subCategory)
        // console.log("coming images in update controller from frontend ----------->", req.files);

        const product = await Product.findOne({ slug });
        if (!product) return res.status(404).json({ message: "Product not found." });
        if (product.creator.toString() !== req.user.id)
            return res.status(403).json({ message: "You are not authorized to update this product." });

        const parsedVariants = variants ? JSON.parse(variants) : null;

        if (title !== undefined) {
            product.title = title;
        }

        let tagIds = [];
        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
            for (const tagName of tagsArray) {
                const tagNameLower = tagName.toLowerCase();
                let tag = await Tag.findOne({ name: tagNameLower });
                if (!tag) {
                    tag = new Tag({ name: tagNameLower });
                    await tag.save();
                }
                if (!tagIds.includes(tag._id)) tagIds.push(tag._id);
            }
        }

        let categoryId = product.category;
        // console.log("Category id before update------->", typeof categoryId)

        if (category) {
            if (mongoose.Types.ObjectId.isValid(category)) {
                const categoryObjectId = new mongoose.Types.ObjectId(category); // Convert string to ObjectId
                console.log("Category ObjectId to be queried:", categoryObjectId);

                const categoryExists = await Category.findById(categoryObjectId);
                console.log("Category Query Result:", categoryExists);

                if (!categoryExists) {
                    return res.status(404).json({ message: `Category not found for ID: ${category}` });
                }
                product.category = categoryObjectId; // Assign as ObjectId
            } else {
                return res.status(400).json({ message: "Invalid category ID format." });
            }
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

        let subCategoryId = product.subCategory;
        console.log("Subcategory id before update------->", subCategoryId);

        if (subCategory) {
            let subCategoryData;
            try {
                subCategoryData = typeof subCategory === 'string' ? JSON.parse(subCategory) : subCategory;
            } catch (error) {
                subCategoryData = subCategory;
            }

            if (typeof subCategoryData === 'object' && subCategoryData._id) {
                // Verify the subcategory exists in DB
                const subCategoryObj = await SubCategory.findById(subCategoryData._id);
                if (!subCategoryObj) {
                    return res.status(400).json({ message: "SubCategory not found." });
                }
                subCategoryId = subCategoryData._id;
            } else if (typeof subCategoryData === 'string') {
                console.log("Searching for subcategory:", subCategoryData);

                // First check if it's a valid ObjectId
                if (mongoose.Types.ObjectId.isValid(subCategoryData)) {
                    const subCategoryObj = await SubCategory.findById(subCategoryData);
                    console.log("Found subcategory by ID:", subCategoryObj);
                    if (!subCategoryObj) {
                        return res.status(400).json({ message: "SubCategory not found." });
                    }
                    subCategoryId = subCategoryObj._id;
                } else {
                    // If not an ObjectId, search by name
                    const subCategoryObj = await SubCategory.findOne({
                        name: subCategoryData.toLowerCase()
                    });
                    console.log("Found subcategory by name:", subCategoryObj);
                    if (!subCategoryObj) {
                        return res.status(400).json({ message: "SubCategory not found." });
                    }
                    subCategoryId = subCategoryObj._id;
                }
            }

            console.log("Subcategory id after update------->", subCategoryId);
        }

        // Handling the images update
        let updatedImages = [];
        if (existingImages) {
            updatedImages = [...JSON.parse(existingImages)];  // Spread existing images into the array
        }

        if (req.files?.images && req.files.images.length > 0) {
            // Append the new images to the existing ones
            for (const file of req.files.images) {
                const myImage = await uploadImage(file);
                updatedImages.push(myImage.url);  // Add new image to the array
            }
        }

        // Handle variants update
        let updatedVariants = [];
        if (parsedVariants) {
            // Replace existing variants with the new ones, but preserve the image property
            updatedVariants = parsedVariants.map(newVariant => {
                const existingVariant = product.variants.find(v => v.value === newVariant.value);
                return {
                    ...newVariant,
                    image: existingVariant ? existingVariant.image : newVariant.image // Preserve existing image if available
                };
            });
        } else {
            // If no new variants are provided, keep the existing ones
            updatedVariants = [...product.variants];
        }

        // Handle the deletion of variants (if any)
        if (req.body.deleteVariants) {
            const variantsToDelete = req.body.deleteVariants.split(',');
            updatedVariants = updatedVariants.filter(variant =>
                !variantsToDelete.includes(variant.value)
            );
        }

        // Handling variant images update (if any)
        if (req.files?.variantImages && req.files.variantImages.length > 0) {
            const variantImageMap = {};
            for (const file of req.files.variantImages) {
                // Extract the variant value from the filename (e.g., "color-red-Screenshot (4).png" => "red")
                const variantValue = file.originalname.split('-')[1]?.toLowerCase();
                const uploadedImage = await uploadImage(file);
                variantImageMap[variantValue] = uploadedImage.url;
            }

            // Assign images to the correct variant values
            updatedVariants = updatedVariants.map(variant => {
                return {
                    ...variant,
                    values: variant.values.map(value => {
                        if (variantImageMap[value.value.toLowerCase()]) {
                            value.image = variantImageMap[value.value.toLowerCase()];
                        }
                        return value;
                    }),
                };
            });
        }


        product.title = title || product.title;
        product.description = description || product.description;
        product.longDescription = longDescription || product.longDescription
        product.price = price || product.price;
        product.salePrice = salePrice === 'null' ? null : salePrice || product.salePrice;
        product.weight = weight || product.weight;
        product.category = categoryId;
        product.subCategory = subCategoryId
        product.stock = stock || product.stock;
        product.brand = brandId;
        product.tags = tagIds.length > 0 ? tagIds : product.tags;
        product.images = updatedImages;
        product.variants = updatedVariants;

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
        const { page = 1, limit = 8 } = req.query;

        const skip = (page - 1) * limit;
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({})
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText',
                populate: {
                    path: 'reviewerId', // Populate reviewer details
                    select: 'name email'
                }
            })
            .skip(skip)
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']])
            .limit(limit);

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

const getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        console.log("Slug while getting product------>", slug)

        const product = await Product.findOne({ slug })
            .populate('category', 'name slug')
            .populate('subCategory', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText',
                populate: {
                    path: 'reviewerId',
                    select: 'name email'
                }
            });
        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        // Calculate the average rating
        const totalRating = product.reviews.reduce((acc, review) => acc + review.rating, 0);
        const averageRating = product.reviews.length > 0 ? totalRating / product.reviews.length : 0;
        console.log("Average rating------>", averageRating)
        product.averageRating = averageRating;
        await product.save();


        console.log("Founded product----->", product)

        res.status(200).json({
            success: true,
            message: 'Product fetched successfully',
            product,
            averageRating
        });
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

        if (product.creator?.toString() !== req.user.id)
            return res.status(403).json({ message: "You are not authorized to delete this product." });

        if (product.images && product.images.length > 0) {
            for (const imageUrl of product.images) {
                // Extract public_id from the image URL
                const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
                // console.log("Public ids of images------>" , publicId)
                await cloudinary.uploader.destroy(publicId);
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
            .populate('category', 'name')
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
            category: categoryId,
            _id: { $ne: excludeProductId }
        })
            .populate('category', 'name')
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
                { path: 'category', select: 'name' },
                { path: 'tags', select: 'name' }
            ]);
        }

        const totalProducts = await Product.countDocuments({
            category: objectedCategoryId,
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
        const { page = 1, limit = 4 } = req.query;
        const skip = (page - 1) * limit;

        const bestSellerTag = await Tag.findOne({ name: 'best seller' });

        // Create aggregation pipeline
        const aggregationPipeline = [];

        // First stage: Match products with best seller tag if exists
        if (bestSellerTag) {
            aggregationPipeline.push({
                $match: { tags: { $in: [bestSellerTag._id] } }
            });

            // Add a field to mark these as tagged best sellers
            aggregationPipeline.push({
                $addFields: { isTaggedBestSeller: true }
            });
        }

        // Second stage: Union with top selling products
        aggregationPipeline.push({
            $unionWith: {
                coll: 'products',
                pipeline: [
                    // Exclude already included tagged products if they exist
                    bestSellerTag ? {
                        $match: {
                            $and: [
                                { tags: { $nin: [bestSellerTag._id] } },
                                { sold: { $gt: 0 } }
                            ]
                        }
                    } : { $match: { sold: { $gt: 0 } } },
                    // Add field to mark these as top sellers
                    { $addFields: { isTaggedBestSeller: false } }
                ]
            }
        });

        // Sorting and limiting
        aggregationPipeline.push(
            {
                $sort: {
                    isTaggedBestSeller: -1, // Tagged products first
                    sold: -1,               // Then by sales
                    createdAt: -1           // Then by newest
                }
            },
            { $skip: skip },
            { $limit: Number(limit) }
        );

        // Lookup for related data
        aggregationPipeline.push(
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $lookup: {
                    from: 'tags',
                    localField: 'tags',
                    foreignField: '_id',
                    as: 'tags'
                }
            },
            {
                $lookup: {
                    from: 'brands',
                    localField: 'brand',
                    foreignField: '_id',
                    as: 'brand'
                }
            },
            { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'reviews',
                    localField: 'reviews',
                    foreignField: '_id',
                    as: 'reviews'
                }
            },
            {
                $addFields: {
                    averageRating: {
                        $cond: {
                            if: { $gt: [{ $size: '$reviews' }, 0] },
                            then: { $avg: '$reviews.rating' },
                            else: 0
                        }
                    }
                }
            }
        );

        // Execute aggregation
        const products = await Product.aggregate(aggregationPipeline);

        // Count total best sellers (both tagged and top selling)
        const countPipeline = [];

        if (bestSellerTag) {
            countPipeline.push({
                $match: { tags: { $in: [bestSellerTag._id] } }
            });
        }

        countPipeline.push({
            $unionWith: {
                coll: 'products',
                pipeline: [
                    bestSellerTag ? {
                        $match: {
                            $and: [
                                { tags: { $nin: [bestSellerTag._id] } },
                                { sold: { $gt: 0 } }
                            ]
                        }
                    } : { $match: { sold: { $gt: 0 } } }
                ]
            }
        });

        countPipeline.push({ $count: 'total' });

        const countResult = await Product.aggregate(countPipeline);
        const totalProducts = countResult[0]?.total || 0;
        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            success: true,
            message: bestSellerTag
                ? 'Best-seller tagged and top selling products fetched successfully'
                : 'Top selling products fetched successfully',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products,
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
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText',
                populate: {
                    path: 'reviewerId',
                    select: 'name email'
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
        const { page = 1, limit = 8 } = req.query;
        const skip = (page - 1) * limit;

        const featuredTag = await Tag.findOne({ name: 'featured' });
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

        const totalProducts = await Product.countDocuments({
            tags: { $in: [featuredTag._id] }
        });

        const totalPages = Math.ceil(totalProducts / limit);

        // Get featured products with pagination
        const products = await Product.find({ tags: { $in: [featuredTag._id] } })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText',
                populate: {
                    path: 'reviewerId',
                    select: 'name email'
                }
            })
            .skip(skip)
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']])
            .limit(limit);

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

        // First find the new tag
        const newTag = await Tag.findOne({ name: 'new' });
        if (!newTag) {
            return res.status(200).json({
                success: true,
                message: 'No new arrivals tag found',
                products: [],
                currentPage: 1,
                totalPages: 0,
                totalProducts: 0
            });
        }

        // Count total new arrival products
        const totalProducts = await Product.countDocuments({
            $and: [
                { tags: { $in: [newTag._id] } },
                { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Last 30 days
            ]
        });

        const totalPages = Math.ceil(totalProducts / limit);

        // Get new arrival products with pagination
        const products = await Product.find({
            $and: [
                { tags: { $in: [newTag._id] } },
                { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Last 30 days
            ]
        })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText',
                populate: {
                    path: 'reviewerId',
                    select: 'name email'
                }
            })
            .skip(skip)
            .sort({ createdAt: -1 })
            .limit(limit);

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
        console.error("Error in fetching new arrival products", error);
        res.status(500).json({ message: "Internal server error" });
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
};
