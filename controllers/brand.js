const Brand = require('../models/brand')
const slugify = require('slugify')
const { uploadImage, deleteImage } = require('../config/cloudinary')


const createBrand = async (req, res) => {
    try {
        const { name, alt } = req.body
        const file = req.file;

        console.log("Coming name----->", name)
        console.log("Coming file----->", file)

        const brandName = slugify(name, { lower: true, strict: true })
        const brandSlug = slugify(name, { lower: true, strict: true })

        const brandExists = await Brand.findOne({ name: brandName })

        if (brandExists) return res.status(400).json({ message: "Brand already exists." })
        if (!name) return res.status(400).json({ message: "Brand name is required." })
        if (!file) return res.status(400).json({ message: "Brand logo is required." })

        const uploadedImage = await uploadImage(file)
        const imageUrl = uploadedImage.url


        const brand = new Brand({
            name: brandName,
            slug: brandSlug,
            logo: imageUrl,
            logo_public_id: uploadedImage.public_id,
            alt: typeof alt === 'string' ? alt.trim() : ''
        })
        await brand.save()

        res.status(201).json({
            message: "Brand created successfully.",
            brand
        })
    } catch (error) {
        console.log("Error in creating brand", error)
        res.status(500).json({ message: "Internal server error" })
    }
}

const getAllBrands = async (req, res) => {
    try {
        const brands = await Brand.find({})
        res.status(200).json({ brands })
    } catch (error) {
        console.log("Error in getting all brands", error)
        res.status(500).json({ message: "Internal server error" })
    }
}


const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, alt } = req.body;
        const file = req.file;

        console.log("Update brand id---->", id);
        console.log("Update brand name---->", name);
        console.log("Update brand file---->", file);

        const brand = await Brand.findById(id);
        if (!brand) {
            return res.status(404).json({ message: "Brand not found." });
        }

        if (!name) {
            return res.status(400).json({ message: "Brand name is required." });
        }

        const brandName = slugify(name, { lower: true, strict: true });
        const brandSlug = slugify(name, { lower: true, strict: true });

        // Check if brand name already exists (excluding current brand)
        const brandExists = await Brand.findOne({ name: brandName, _id: { $ne: id } });
        if (brandExists) {
            return res.status(400).json({ message: "Brand name already exists." });
        }

        // Check if slug already exists (excluding current brand)
        const slugExists = await Brand.findOne({ slug: brandSlug, _id: { $ne: id } });
        if (slugExists) {
            return res.status(400).json({ message: "Brand slug already exists." });
        }

        let imageUrl = brand.logo;
        let logo_public_id = brand.logo_public_id;

        // If new image is uploaded, delete old image and upload new one
        if (file) {
            // Delete old image from Cloudinary
            if (brand.logo_public_id) {
                try {
                    await deleteImage(brand.logo_public_id);
                    console.log("Old image deleted from Cloudinary");
                } catch (error) {
                    console.log("Error deleting old brand logo", error);
                }
            }

            // Upload new image
            const uploadedImage = await uploadImage(file);
            imageUrl = uploadedImage.url;
            logo_public_id = uploadedImage.public_id;
        }

        // Update brand
        const updatedBrand = await Brand.findByIdAndUpdate(
            id,
            {
                name: brandName,
                slug: brandSlug,
                logo: imageUrl,
                logo_public_id: logo_public_id,
                ...(alt !== undefined ? { alt: String(alt).trim() } : {})
            },
            { new: true }
        );

        res.status(200).json({
            message: "Brand updated successfully.",
            brand: updatedBrand
        });
    } catch (error) {
        console.log("Error in updating brand", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Brand id----", id)
        const brand = await Brand.findById({ _id: id })
        if (!brand) return res.status(404).json({ message: "Brand not found." })
        if (brand.logo_public_id) {
            try {
                const deletedImage = await deleteImage(brand.logo_public_id)
                console.log("Deleted image---->", deletedImage)
            } catch (error) {
                console.log("Error deleting brand logo", error)
            }
        }
        await Brand.findByIdAndDelete({ _id: id })
        res.status(200).json({
            message: "Brand deleted successfully."
        })
    } catch (error) {
        console.log("Error in deleting brand", error)
        res.status(500).json({ message: "Internal server error" })
    }
}

module.exports = { createBrand, getAllBrands, updateBrand, deleteBrand }