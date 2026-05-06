import Project from "../models/Project.js";

export const createProject = async (req, res) => {
  const project = await Project.create({
    ...req.body,
    userId: req.user.id,
  });

  res.json(project);
};

export const getUserProjects = async (req, res) => {
  const projects = await Project.find({ userId: req.user.id });
  res.json(projects);
};

export const getProjectByShareId = async (req, res) => {
  try {
    const project = await Project.findOne({
      shareId: req.params.shareId,
    }).select("projectName rooms totalCost report createdAt shareId");

    if (!project) {
      return res.status(404).json({ msg: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
