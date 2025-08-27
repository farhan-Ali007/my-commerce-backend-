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
        console.log("Error in deleting tag", error)
        res.status(500).json({ message: "Internal server error" })
    }
}

// Update tag name
const updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Tag name is required.' });
        }

        const normalized = name.toLowerCase().trim();

        // Ensure tag exists
        const existing = await Tag.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Tag not found.' });
        }

        // Check uniqueness (exclude current id)
        const duplicate = await Tag.findOne({ name: normalized, _id: { $ne: id } });
        if (duplicate) {
            return res.status(409).json({ message: 'A tag with this name already exists.' });
        }

        existing.name = normalized;
        await existing.save();

        return res.status(200).json({
            success: true,
            message: 'Tag updated.',
            tag: existing,
        });
    } catch (error) {
        console.log('Error in updating tag', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

module.exports = { createTag, getAllTags, deleteTag, updateTag }