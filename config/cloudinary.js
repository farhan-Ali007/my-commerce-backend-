const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    api_timeout: 60000,
});

const uploadImage = async (file, type = "product") => {
    try {
        console.log(`Uploading ${type} image to Cloudinary-------->`, file.path);

        // Set folder based on image type
        const folderName = type === "banner" ? "banners" : "product-images";

        // Set transformation based on type
        const transformation =
            type === "banner"
                ? [{ width: 1920, height: 700, crop: "scale" }] // Banner size
                : [{ width: 500, height: 500, crop: "limit" }]; // Product size

        const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: folderName,
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            transformation,
        });

        return {
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
        };
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Failed to upload image to Cloudinary");
    }
};


const deleteImage = async (publicId) => {
    try {
        console.log("Deleting image from Cloudinary-------->", publicId);
        const deleteResult = await cloudinary.uploader.destroy(publicId);
        console.log("Cloudinary delete result:", deleteResult);
        return deleteResult;
    } catch (error) {
        console.error("Cloudinary delete error:", error);
        throw new Error('Failed to delete image from Cloudinary');
    }
};

module.exports = { uploadImage, deleteImage };
