const Brand = require('../models/brand')
const slugify = require('slugify')
const { uploadImage, deleteImage } = require('../config/cloudinary')


const createBrand = async (req, res) => {
    try {
        const { name } = req.body
        const file = req.file;

        console.log("Coming name----->", name)
        console.log("Coming file----->", file)

        const brandName = slugify(name, { lower: true, strict: true })

        const brandExists = await Brand.findOne({ name: brandName })

        if (brandExists) return res.status(400).json({ message: "Brand already exists." })
        if (!name) return res.status(400).json({ message: "Brand name is required." })
        if (!file) return res.status(400).json({ message: "Brand logo is required." })

        const uploadedImage = await uploadImage(file)
        const imageUrl = uploadedImage.url


        const brand = new Brand({
            name: brandName,
            logo: imageUrl,
            logo_public_id: uploadedImage.public_id
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

module.exports = { createBrand, getAllBrands, deleteBrand }