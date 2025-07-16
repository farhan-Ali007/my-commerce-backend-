const topBar = require("../models/topbar");

const addBarText = async (req, res) => {
  try {
    const { text, enabled } = req.body;
    console.log("Coming data------>", req.body);
    const newText = new topBar({
      text: text,
      isEnable: enabled,
    });

    await newText.save();
    res.status(200).json({ message: "Text added." });
  } catch (error) {
    console.log("Erorr in adding text for topbar", error);
    res.status(500).json({
      message: "Internal server error.",
    });
  }
};

const updateBarText = async (req, res) => {
  try {
    const { text, enabled } = req.body;
    const { id } = req.params;

    const updatedText = await topBar.findByIdAndUpdate(
      id,
      { text: text, isEnable: enabled },
      { new: true }
    );

    if (!updatedText) {
      return res.status(404).json({ message: "Text not found." });
    }

    res.status(200).json({ message: "Text updated.", updatedText });
  } catch (error) {
    console.log("Error in updating topbar text:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getAllBarTexts = async (req, res) => {
  try {
    const allBarTexts = await topBar.find({});

    res.status(200).json({ message: "Topbar texts fetched.", allBarTexts });
  } catch (error) {
    console.log("Error in fetching all topbar texts:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const deleteBarText = async (req, res) => {
  try {
    const { id } = req.params;

    const barText = await topBar.findByIdAndDelete(id);

    if (!barText) {
      return res.status(404).json({ message: "Text not found." });
    }

    res.status(200).json({ message: "Text deleted.", barText });
  } catch (error) {
    console.log("Error in deleting the topbar text:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const getActiveBars = async (req, res) => {
  try {
    const activeBars = await topBar
      .find({ isEnable: true })
      .populate("text isEnable");

    res.status(200).json({ message: "Texts fetched", activeBars });
  } catch (error) {
    console.log("Error in fetching active bars.");
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  addBarText,
  updateBarText,
  getAllBarTexts,
  deleteBarText,
  getActiveBars,
};
