const express = require('express');
const { getProductsByCategory, upload,addProduct, getCategories, getOccasions, addOccasion, getProductsByOccasion, getSizesByCategory, getAllProducts, addCategory, getProductCountByCategory, getProductById, getReviewsByProductId, addReview, addCartItem, getCartItems, clearCart, removeCartItem } = require('../controller/product');
const multer = require('multer');
const router = express.Router();

router.get('/category/:category', getProductsByCategory);
router.get('/category/:category/subcategory/:subcategory', getProductsByCategory);

router.post('/addProduct', upload.single('image'), addProduct);

router.get('/occasion/:occasion', getProductsByOccasion);
router.get('/sizes/:category', getSizesByCategory); // Add this line
router.get('/all-products', getAllProducts);
router.get('/count/:category', getProductCountByCategory);
router.get("/getOccasions", getOccasions);
router.post("/occasion", addOccasion);
router.get("/categories", getCategories);
router.post('/category', upload.single('image'), addCategory);
router.get('/product/:productId', getProductById);
router.get('/getReviewsByProductId/:productId', getReviewsByProductId);
router.post('/addReview', addReview);
router.post('/cart/add', addCartItem);
router.get('/cart/:userId', getCartItems);
router.delete('/cart/:userId', clearCart);
router.post('/cart/remove', removeCartItem);

module.exports = router;
