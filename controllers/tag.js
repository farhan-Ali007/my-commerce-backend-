const Tag = require('../models/tag.js')


const createTag = async (req, res) => {
    try {
        const { name } = req.body;
        const newName = name.toLowerCase()
        const newTag = new Tag({ name: newName })
        await newTag.save()

        res.status(200).json({
            success: true,
            message: "Tag added.",
            newTag
        })

    } catch (error) {
        console.log("Error in creating tag", error)
        res.status(500).json({ message: "Internal server error" })

    }
}

const getAllTags = async (req, res) => {
    try {

        const tags = await Tag.find({})
        res.status(200).json({
            success: true,
            message: "All tags fetched successfully",
            tags
        })

    } catch (error) {
        console.log("Error in fetching all tags.")
        res.status(500).json({ message: "Internal server error" })
    }
}

const deleteTag = async (req, res) => {
    try {
        const { id } = req.params;

        const tag = await Tag.findById(id)
        if (!tag)
            return res.status(404).json({ message: "Tag not found." })

        const deletedTag = await Tag.findByIdAndDelete(id)

        res.status(200).json({
            success: true,
            message: "Tag deleted.",
            deletedTag
        })

    } catch (error) {

    }
}

module.exports = { createTag, getAllTags, deleteTag }