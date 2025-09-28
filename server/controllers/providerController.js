import ProviderApplication from '../models/ProviderApplication.js';
import User from '../models/User.js';

// Submit a new provider application (public)
export const submitProviderApplication = async (req, res, next) => {
  try {
    const { name, email, password, organization, website, message } = req.body;
    if (!name || !email || !password || !organization) {
      return res.status(400).json({ success: false, message: 'Name, email, password and organization are required' });
    }
    // Prevent duplicate pending apps by email
    const existing = await ProviderApplication.findOne({ email: email.toLowerCase(), status: 'pending' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have a pending application' });
    }
    const app = await ProviderApplication.create({
      name,
      email: email.toLowerCase(),
      password,
      organization,
      website,
      message
    });
    res.status(201).json({ success: true, data: app });
  } catch (err) { next(err); }
};

// List provider applications (website admin only)
export const listProviderApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const query = status === 'all' ? {} : { status };
    const apps = await ProviderApplication.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'name email role');
    const total = await ProviderApplication.countDocuments(query);
    res.status(200).json({ success: true, data: apps, total, currentPage: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// Approve application -> create user as course_admin
export const approveProviderApplication = async (req, res, next) => {
  try {
    const app = await ProviderApplication.findById(req.params.id).select('+password');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'pending') return res.status(400).json({ success: false, message: 'Application already processed' });
    // Create user if not already created
    let user = await User.findOne({ email: app.email });
    if (!user) {
      if (!app.password) {
        return res.status(400).json({ success: false, message: 'Application is missing a password' });
      }
      user = new User({ name: app.name, email: app.email, password: app.password, role: 'course_admin' });
      await user.save();
    } else {
      // If user already exists, just elevate role
      if (user.role !== 'course_admin') {
        await User.findByIdAndUpdate(user._id, { role: 'course_admin' });
      }
    }
    app.user = user._id;
    app.status = 'approved';
    app.decidedAt = new Date();
    app.decidedBy = req.user.id;
    // Clear stored password now that the user is created
    app.password = undefined;
    await app.save();
    res.status(200).json({ success: true, data: app });
  } catch (err) { next(err); }
};

// Deny application
export const denyProviderApplication = async (req, res, next) => {
  try {
    const app = await ProviderApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.status !== 'pending') return res.status(400).json({ success: false, message: 'Application already processed' });
    app.status = 'denied';
    app.decidedAt = new Date();
    app.decidedBy = req.user.id;
    app.notes = req.body.notes;
    await app.save();
  // No user exists yet in the normal flow; nothing else to do
    res.status(200).json({ success: true, data: app });
  } catch (err) { next(err); }
};
