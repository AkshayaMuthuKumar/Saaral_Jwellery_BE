const { pool, generateProductId } = require('../config/database'); // Adjust the path as needed
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.mp4' && ext !== '.mov' && ext !== '.avi') {
      return cb(new Error('Only video files are allowed'));
    }
    cb(null, true);
  }
});

const addProduct = async (req, res) => {
  try {
    const { name, price, category, subcategory, occasion, stock, size } = req.body;

    if (!name || !category || !subcategory || !price || !stock || !occasion || !req.file) {
      return res.status(400).json({ message: "All fields except size are required" });
    }

    const productId = await generateProductId(category);

    // Upload image to S3 and get the URL
    const imageUrl = req.file.buffer;;

    // Insert product into the database with image URL
    const [result] = await pool.query(
      `INSERT INTO products (product_id, name, category, subcategory, occasion, image, price, stock, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, name, category, subcategory, occasion, imageUrl, price, stock, size || null]
    );

    res.status(201).json({ message: 'Product added successfully', productId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error adding product: ${error.message}` });
  }
};

const addCategory = async (req, res) => {
  const { category_name, subcategory_name } = req.body;

  if (!category_name || !subcategory_name) {
    return res.status(400).json({ message: "Category and Subcategory names are required." });
  }

  try {
    const imageUrl = req.file.buffer;;


    // Insert category into the database with the image blob
    const [result] = await pool.query(
      "INSERT INTO category (category_name, subcategory_name, image) VALUES (?, ?, ?)",
      [category_name, subcategory_name, imageUrl]
    );

    res.status(201).json({ message: "Category added successfully", id: result.insertId });
  } catch (error) {
    console.error("Error in addCategory:", error);

    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: `Duplicate entry: ${subcategory_name} already exists.` });
    } else {
      res.status(500).json({ message: "Error adding category", error: error.message });
    }
  }
};



const addOccasion = async (req, res) => {
  const { name } = req.body;

  try {
    // Insert the occasion name and image blob into the database
    const [result] = await pool.query(
      "INSERT INTO occasions (name) VALUES (?)",
      [name]
    );

    res.status(201).json({ message: "Occasion added successfully", id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding occasion" });
  }
};


const getProductsByOccasion = async (req, res) => {
  try {
    const { occasion } = req.params;
    const { page = 1, limit = 9, priceRange = 'all' } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Set up the price range condition if provided
    let priceCondition = '';
    const queryParams = [occasion, offset, limitNumber];

    if (priceRange !== 'all') {
      const [minPrice, maxPrice] = priceRange.split('-').map(Number);
      priceCondition = `AND price BETWEEN ? AND ?`;
      queryParams.splice(1, 0, minPrice, maxPrice); // Insert minPrice and maxPrice in the query parameters
    }

    // Fetch products by occasion with the specified price range, if any
    const [rows] = await pool.query(
      `SELECT product_id, name, category, subcategory, occasion, image, size, price, stock 
      FROM products WHERE occasion = ? ${priceCondition} LIMIT ?, ?`,
      queryParams
    );

    // Count total products for pagination
    const countQueryParams = [occasion];
    if (priceRange !== 'all') {
      countQueryParams.splice(1, 0, minPrice, maxPrice);
    }
    const [totalCount] = await pool.query(
      `SELECT COUNT(*) as count FROM products WHERE occasion = ? ${priceCondition}`,
      countQueryParams
    );

    const totalPages = Math.ceil(totalCount[0].count / limitNumber);

    // Format products to encode images as Base64
    const formattedProducts = rows.map(product => ({
      ...product,
      image: product.image ? `data:image/jpeg;base64,${product.image.toString('base64')}` : null,
    }));

    // Send the products and pagination info
    res.json({ products: formattedProducts, totalPages });
  } catch (error) {
    console.error('Error fetching products by occasion:', error);
    res.status(500).json({ message: 'Error fetching products by occasion' });
  }
};



const getSizesByCategory = async (req, res) => {
  try {
    const { category, subcategory } = req.params; // Fetch both category and subcategory from params

    const [rows] = await pool.query(`
      SELECT size, COUNT(*) AS count 
      FROM products 
      WHERE category = ? AND (subcategory = ? OR ? IS NULL) AND size IS NOT NULL AND size <> ''
      GROUP BY size
    `, [category, subcategory || null, subcategory]); // Check for subcategory only if it's provided

    res.json({ sizes: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching sizes' });
  }
};

const getProductCountByCategory = async (req, res) => {
  try {
    const { category } = req.params; // Get category from request parameters
    const [rows] = await pool.query(`
      SELECT COUNT(*) as count
      FROM products 
      WHERE category = ?
    `, [category]);

    res.json({ count: rows[0].count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching product count' });
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    const { page = 1, limit = 9, priceRange = 'all', size, occasion, search } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Initialize conditions for the SQL query
    let conditions = 'WHERE category = ?';
    const queryParams = [category];

    // Add subcategory filter if exists
    if (subcategory) {
      conditions += ' AND subcategory = ?';
      queryParams.push(subcategory);
    }

    // Add occasion filter
    if (occasion) {
      conditions += ' AND occasion = ?';
      queryParams.push(occasion);
    }

    // Add size filter
    if (size) {
      conditions += ' AND size = ?';
      queryParams.push(size);
    }

    // Handle price range filter
    if (priceRange && priceRange !== 'all') {
      const [minPrice, maxPrice] = priceRange.split('-').map(Number);
      if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        conditions += ' AND price BETWEEN ? AND ?';
        queryParams.push(minPrice, maxPrice);
      }
    }

    if (search) {
      conditions += ' AND (name LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    // Fetch products based on selected filters
    const query = `
      SELECT p.product_id, p.name, p.category, p.subcategory, p.occasion, p.image, p.price, p.stock, p.size
      FROM products p 
      ${conditions}
      LIMIT ?, ?
    `;
    const productsParams = [...queryParams, offset, limitNumber];

    // Execute the query with parameters
    const [rows] = await pool.query(query, productsParams);

    // Fetch total count for pagination
    const countQuery = `SELECT COUNT(*) as count FROM products ${conditions}`;
    const [totalCount] = await pool.query(countQuery, queryParams);

    const totalPages = Math.ceil(totalCount[0].count / limitNumber);

    // Format products, encoding image data to Base64
    const formattedProducts = rows.map(product => ({
      ...product,
      image: product.image ? `data:image/jpeg;base64,${product.image.toString('base64')}` : null,
    }));

    // Send the filtered products and pagination info
    res.json({ products: formattedProducts, totalPages });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};


const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 9 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Fetch all products with pagination
    const [rows] = await pool.query(`
      SELECT product_id, name, category, subcategory, occasion, image, price, stock, size 
      FROM products
      LIMIT ?, ?
    `, [offset, limitNumber]);

    // Fetch total count for pagination
    const [totalCount] = await pool.query(`SELECT COUNT(*) as count FROM products`);
    const totalPages = Math.ceil(totalCount[0].count / limitNumber);

    // Format the products to encode images as Base64
    const formattedProducts = rows.map(product => ({
      ...product,
      image: product.image ? `data:image/jpeg;base64,${product.image.toString('base64')}` : null,
    }));

    // Send all products and pagination info
    res.json({ products: formattedProducts, totalPages });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};


const getOccasions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Fetch unique occasions with pagination and count of products for each occasion
    const [occasions] = await pool.query(`
      SELECT o.name, COUNT(p.id) AS productCount
      FROM occasions o
      LEFT JOIN products p ON p.occasion = o.name
      GROUP BY o.name
      LIMIT ?, ?
    `, [offset, limitNumber]);

    // Fetch total count of occasions for pagination
    const [totalCount] = await pool.query(`SELECT COUNT(*) as count FROM occasions`);
    const totalPages = Math.ceil(totalCount[0].count / limitNumber);

    // Return the paginated list of occasions with associated product counts
    res.json({ occasions, totalPages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching occasions and products" });
  }
};

const getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT category_name, MIN(image) AS image, GROUP_CONCAT(subcategory_name) AS subcategories
      FROM category
      GROUP BY category_name
    `);

    // Format the categories to include subcategories as arrays and images in Base64
    const formattedCategories = rows.map(row => ({
      category_name: row.category_name,
      image: row.image ? `data:image/jpeg;base64,${row.image.toString('base64')}` : null,
      subcategories: row.subcategories.split(',')
    }));

    res.json({ categories: formattedCategories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: "Error fetching categories" });
  }
};


const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    // Query to get product details from the database
    const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ?', [productId]);

    // Check if the product exists
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = rows[0];

    // Convert the image to Base64 if it exists
    product.image = product.image ? `data:image/jpeg;base64,${product.image.toString('base64')}` : null;

    // Fetch sizes associated with the product
    const [sizeRows] = await pool.query(
      'SELECT DISTINCT size FROM products WHERE name = ? AND category = ?',
      [product.name, product.category]
    );

    // Attach sizes to the product object
    product.sizes = sizeRows.map(row => row.size);

    // Return the product details with sizes
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error fetching product details' });
  }
};

const getReviewsByProductId = async (req, res) => {
  const { productId } = req.params;

  try {
    const [result] = await pool.query('SELECT * FROM reviews WHERE productId = ? ORDER BY createdAt DESC', [productId]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'No reviews found for this product' });
    }

    res.status(200).json({
      message: 'Reviews fetched successfully',
      data: result, 
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

const addReview = async (req, res) => {
  const { productId, name, email, purchaseDate, experience, rating, review } = req.body; // Extract review data from the request body

  // Basic validation
  if (!productId || !name || !email || !purchaseDate || !experience || !rating || !review) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Query to insert the new review into the reviews table
    const [result] = await pool.query(
      'INSERT INTO reviews (productId, name, email, purchaseDate, experience, rating, review) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [productId, name, email, purchaseDate, experience, rating, review]
    );

    // Send a success response if the review was added
    res.status(201).json({
      message: 'Review added successfully',
      data: {
        id: result.insertId, // ID of the new review
        productId,
        name,
        email,
        purchaseDate,
        experience,
        rating,
        review,
      },
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Error adding review' });
  }
};

const addCartItem = async (req, res) => {
  const { userId, product } = req.body; 

  if (!userId || !product || !product.id || !product.quantity) {
    return res.status(400).json({ message: "User ID and product details are required." });
  }

  try {
    const [existingItem] = await pool.query(
      "SELECT * FROM cart WHERE user_id = ? AND product_id = ? AND size = ?",
      [userId, product.id, product.size]
    );

    if (existingItem.length > 0) {
      const updatedQuantity = existingItem[0].quantity + product.quantity;
      await pool.query(
        "UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ? AND size = ?",
        [updatedQuantity, userId, product.id, product.size]
      );
      return res.status(200).json({ message: "Cart item quantity updated." });
    } else {
      // Fetch the image as a LONGBLOB from the products table and encode it as Base64
      const [productImageResult] = await pool.query(
        "SELECT image FROM products WHERE product_id = ?",
        [product.id]
      );

      const imageBlob = productImageResult[0]?.image;
      const base64Image = imageBlob ? `data:image/jpeg;base64,${imageBlob.toString('base64')}` : null;

      // Insert a new cart item with the Base64 image
      const result = await pool.query(
        "INSERT INTO cart (user_id, product_id, quantity, product_name, size, price, image) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, product.id, product.quantity, product.product_name, product.size, product.price, base64Image]
      );
      return res.status(201).json({ message: "Item added to cart", cartId: result.insertId });
    }
  } catch (error) {
    console.error("Error adding item to cart:", error);
    res.status(500).json({ message: "Error adding item to cart", error: error.message });
  }
};

const getCartItems = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM cart WHERE user_id = ?', [userId]);

    if (rows.length === 0) {
      return res.json({ items: [] }); 
    }

    const formattedItems = rows.map(item => ({
      ...item,
      image: item.image ? `data:image/jpeg;base64,${item.image.toString('base64')}` : null,
    }));

    res.json({ items: formattedItems });
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ message: 'Error fetching cart items' });
  }
};


const clearCart = async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    await pool.query('DELETE FROM cart WHERE user_id = ?', [userId]);
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Error clearing cart' });
  }
};

const removeCartItem = async (req, res) => {
  const { userId, productId, size } = req.body;

  // Validate the required fields
  if (!userId || !productId || !size) {
    return res.status(400).json({ message: "User ID, product ID, and size are required." });
  }

  try {
    // Ensure that productId is treated as a string for comparison
    const [result] = await pool.query(
      "DELETE FROM cart WHERE user_id = ? AND product_id = ? AND size = ?",
      [parseInt(userId, 10), productId.toString(), size] // Convert productId to string
    );

    if (result.affectedRows > 0) {
      return res.status(200).json({ message: "Item removed from cart" });
    } else {
      return res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error('Error removing item from cart:', error);
    return res.status(500).json({ message: "Error removing item from cart", error: error.message });
  }
};





module.exports = { getProductsByCategory, addProduct, upload, getCategories, getOccasions, addOccasion, getProductsByOccasion, getSizesByCategory, getAllProducts, getOccasions, addOccasion, getCategories, addCategory, getProductCountByCategory, getProductById, getReviewsByProductId, addReview, addCartItem, getCartItems, clearCart, removeCartItem };
