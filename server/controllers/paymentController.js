import Razorpay from 'razorpay';
import crypto from 'crypto';
import Course from '../models/Course.js';
import Payment from '../models/Payment.js';
import Enrollment from '../models/Enrollment.js';

// Validate presence of credentials; allow forced demo mode
const missingKey = !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET;
const forceDemo = String(process.env.DEMO_PAYMENTS).toLowerCase() === 'true';
let razor = null;
if (!missingKey && !forceDemo) {
  razor = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[PAYMENT] Running in DEMO mode (no live Razorpay).');
  }
}

export const createOrder = async (req, res, next) => {
  try {
    const { courseId } = req.body;
  if (missingKey || !razor || forceDemo) {
      // Demo mode: simulate successful payment, auto-enroll
      const course = await Course.findById(courseId).select('price isPublished enrolledStudents totalEnrollments');
      if (!course || !course.isPublished) {
        return res.status(404).json({ success:false, message:'Course not found' });
      }
      if (course.price === 0) {
        return res.status(400).json({ success:false, message:'Course is free' });
      }
      // Upsert payment as paid
      await Payment.findOneAndUpdate(
        { user: req.user._id, course: courseId },
        { amount: course.price, currency: 'INR', status:'paid', razorpayOrderId: 'demo_order_'+Date.now() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      // Enroll if not already
      const existing = await Enrollment.findOne({ student: req.user._id, course: courseId });
      if (!existing) {
        await Enrollment.create({ student: req.user._id, course: courseId, progress: { currentLesson: null, progressPercentage:0, completedLessons: [] }});
        await Course.findByIdAndUpdate(courseId, { $inc: { totalEnrollments: 1 }, $addToSet: { enrolledStudents: req.user._id } });
      }
      return res.status(201).json({ success:true, data:{ demo:true, courseId, enrolled:true, message:'Demo payment success (no gateway configured)' } });
    }
    if (!req.user) {
      console.warn('[PAYMENT][createOrder] Missing req.user. Auth failed before controller.');
    } else {
      console.log('[PAYMENT][createOrder] user:', req.user._id.toString(), 'courseId:', courseId);
    }
    const course = await Course.findById(courseId).select('price isPublished');
    if (!course || !course.isPublished) {
      return res.status(404).json({ success:false, message:'Course not found' });
    }
    if (course.price === 0) {
      return res.status(400).json({ success:false, message:'Course is free' });
    }
    const amountPaise = Math.round(course.price * 100);
    let order;
    try {
      order = await razor.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `course_${courseId}_${Date.now()}`,
        notes: { courseId }
      });
    } catch (rpErr) {
      // Map Razorpay auth errors to a clear client message
      if (rpErr?.statusCode === 401 || rpErr?.error?.code === 'BAD_REQUEST_ERROR') {
        console.error('[PAYMENT][RazorpayAuthError]', rpErr?.error?.description || rpErr.message);
        return res.status(502).json({ success:false, message:'Payment gateway authentication failed. Please verify API keys.' });
      }
      console.error('[PAYMENT][RazorpayOrderError]', rpErr.message);
      return res.status(502).json({ success:false, message:'Unable to create payment order. Try again later.' });
    }
    await Payment.findOneAndUpdate(
      { user: req.user._id, course: courseId },
      { amount: course.price, currency: 'INR', razorpayOrderId: order.id, status:'created' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success:true, data: { orderId: order.id, amount: course.price, currency: 'INR', key: process.env.RAZORPAY_KEY_ID, courseId } });
  } catch (err) { return next(err); }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, course: courseId, user: req.user._id });
    if (!payment) return res.status(404).json({ success:false, message:'Payment record not found' });

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    if (missingKey || forceDemo) {
      return res.status(400).json({ success:false, message:'Demo mode: verification not required' });
    }
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success:false, message:'Invalid signature' });
    }
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';
    await payment.save();

    const existing = await Enrollment.findOne({ student: req.user._id, course: courseId });
    if (!existing) {
      await Enrollment.create({ student: req.user._id, course: courseId, progress: { currentLesson: null, progressPercentage:0, completedLessons: [] }});
      await Course.findByIdAndUpdate(courseId, { $inc: { totalEnrollments: 1 }, $addToSet: { enrolledStudents: req.user._id } });
    }
    res.status(200).json({ success:true, message:'Payment verified and enrollment granted' });
  } catch (err) { next(err); }
};
