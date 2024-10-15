const express = require('express');
const Razorpay = require('razorpay');

const productRoutes = require('./routes/product');
const authRoutes = require('./routes/auth');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const razorpay = new Razorpay({
  key_id: 'rzp_test_OK03rE3KWdrU3p',
  key_secret: 'dAVM1lNbabnddvEPeJTNKzu3'
});
// Middleware
app.use(cors()); 
app.use(express.json()); 

// Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.post('/create-order', async (req, res) => {
  const { amount, currency } = req.body; 

  const options = {
    amount: amount * 100, 
    currency: currency,
    receipt: 'receipt#1',
  };

  try {
    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
