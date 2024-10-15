const { pool, generateProductId } = require('../config/database'); // Adjust the path as needed
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Directory where files will be saved
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
  },
});
const upload = multer({ storage });


const addProduct = async (req, res) => {
  try {
    const { name, price, category, subcategory, occasion, stock, size } = req.body;

    // Check required fields
    if (!name || !category || !subcategory || !price || !stock || !occasion) {
      return res.status(400).json({ message: "All fields except size and image are required" });
    }

    const image = req.file.path;

    // Generate product ID
    const productId = await generateProductId(category);

    // Insert a new product into the database
    const [result] = await pool.query(`
      INSERT INTO products (product_id, name, category, subcategory, occasion, image, price, stock, size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [productId, name, category, subcategory, occasion, image, price, stock, size || null]); // Ensure 'subcategory' is included here

    res.status(201).json({ message: 'Product added successfully', productId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `Error adding product: ${error.message}` });
  }
};

const addOccasion = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const result = await pool.query("INSERT INTO occasions (name) VALUES (?)", [
      name,
    ]);
    res.status(201).json({ message: "occasions added successfully", id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding occasions" });
  }
};

const getProductsByOccasion = async (req, res) => {
  try {
    const { occasion } = req.params;
    const { page = 1, limit = 9, priceRange = 'all' } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    let priceCondition = '';
    if (priceRange && priceRange !== 'all') {
      const [minPrice, maxPrice] = priceRange.split('-').map(Number);
      priceCondition = `AND price BETWEEN ${minPrice} AND ${maxPrice}`;
    }

    const [rows] = await pool.query(`
      SELECT product_id, name, category, subcategory, occasion, image, size, price, stock 
      FROM products
      WHERE occasion = ? ${priceCondition}
      LIMIT ?, ?
    `, [occasion, offset, limitNumber]);

    const [totalCount] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM products
      WHERE occasion = ? ${priceCondition}
    `, [occasion]);

    const totalPages = Math.ceil(totalCount[0].count / limitNumber);

    // Format the image URLs for the fetched products
    const formatProductImages = (products) => {
      return products.map(product => ({
        ...product,
        image: `${req.protocol}://${req.get('host')}/${product.image.replace(/\\/g, '/')}` // Correct the image path format
      }));
    };

    // Format the images for the occasion-based products
    const formattedProducts = formatProductImages(rows);

    res.json({ products: formattedProducts, totalPages });
  } catch (error) {
    console.error(error);
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
    const { category, subcategory } = req.params; // Get category and subcategory
    const { page = 1, limit = 9, priceRange = 'all', size, occasion } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Initialize conditions for the SQL query
    let conditions = 'WHERE category = ?'; // Ensure category is required
    const queryParams = [category]; // Start with category parameter

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
    const formattedProducts = rows.map(product => ({
      ...product,
      image: `${req.protocol}://${req.get('host')}/${product.image.replace(/\\/g, '/')}`,
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
    const { page = 1, limit = 9 } = req.query; // Extract query parameters
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    // Fetch all products from the database
    const [rows] = await pool.query(`
      SELECT product_id, name, category, subcategory, occasion, image, price, stock, size 
      FROM products
      LIMIT ?, ?
    `, [offset, limitNumber]);

    // Fetch total count for pagination
    const [totalCount] = await pool.query(`SELECT COUNT(*) as count FROM products`);

    const totalPages = Math.ceil(totalCount[0].count / limitNumber);

    // Format the image URLs for the fetched products
    const formatProductImages = (products) => {
      return products.map(product => ({
        ...product,
        image: `${req.protocol}://${req.get('host')}/${product.image.replace(/\\/g, '/')}` // Correct the image path format
      }));
    };

    const formattedProducts = formatProductImages(rows);

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

    // Format the result to return an array of subcategories for each category
    const formattedCategories = rows.map(row => ({
      category_name: row.category_name,
      // Format the image URL correctly
      image: `${req.protocol}://${req.get('host')}/${row.image.replace(/\\/g, '/')}`,
      subcategories: row.subcategories.split(','),
    }));

    res.json({ categories: formattedCategories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching categories" });
  }
};




const addCategory = async (req, res) => {
  console.log(req.body); // Log the body to see if category_name and subcategory_name are present
  console.log(req.file);  // Log the file to check if the image is uploaded

  const { category_name, subcategory_name } = req.body;
  if (!category_name || !subcategory_name) {
    return res.status(400).json({ message: "Category and Subcategory names are required." });
  }

  const image = req.file ? req.file.path : null; // Ensure image is available

  try {
    const result = await pool.query(
      "INSERT INTO category (category_name, subcategory_name, image) VALUES (?, ?, ?)",
      [category_name, subcategory_name, image]
    );
    res.status(201).json({ message: "Category added successfully", id: result.insertId });
  } catch (error) {
    console.error(error);

    // Check for duplicate entry error
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: `Duplicate entry: ${subcategory_name} already exists.` });
    } else {
      res.status(500).json({ message: "Error adding category", error: error.message });
    }
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

    // Format the image URL
    product.image = `${req.protocol}://${req.get('host')}/${product.image.replace(/\\/g, '/')}`; // Correct the image path format

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
  const { productId } = req.params; // Extract productId from the request parameters

  try {
    // Query to fetch reviews for the product
    const [result] = await pool.query('SELECT * FROM reviews WHERE productId = ? ORDER BY createdAt DESC', [productId]);

    // Check if there are reviews for the product
    if (result.length === 0) {
      return res.status(404).json({ message: 'No reviews found for this product' });
    }

    // Send the reviews as a response
    res.status(200).json({
      message: 'Reviews fetched successfully',
      data: result, // Send all reviews for the product
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
  const { userId, product } = req.body; // Expecting userId and product details
  console.log("userId", userId);
  console.log("product", product);

  if (!userId || !product || !product.id || !product.quantity) {
    return res.status(400).json({ message: "User ID and product details are required." });
  }

  try {
    // Check if the product already exists in the cart for the user
    const [existingItem] = await pool.query(
      "SELECT * FROM cart WHERE user_id = ? AND product_id = ? AND size = ?",
      [userId, product.id, product.size]
    );

    if (existingItem.length > 0) {
      // Product already exists, so update the quantity
      const updatedQuantity = existingItem[0].quantity + product.quantity;
      await pool.query(
        "UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ? AND size = ?",
        [updatedQuantity, userId, product.id, product.size]
      );
      return res.status(200).json({ message: "Cart item quantity updated." });
    } else {
      // Product does not exist, insert a new item
      const result = await pool.query(
        "INSERT INTO cart (user_id, product_id, quantity, product_name, size, price, image) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, product.id, product.quantity, product.product_name, product.size, product.price, product.image]
      );
      return res.status(201).json({ message: "Item added to cart", cartId: result.insertId });
    }
  } catch (error) {
    console.error("Error adding item to cart:", error);
    res.status(500).json({ message: "Error adding item to cart", error: error.message });
  }
};



// Method to get cart items for a specific user
const getCartItems = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM cart WHERE user_id = ?', [userId]);

    if (rows.length === 0) {
      return res.json({ items: [] }); // Return an empty array for cart items
    }
    console.log("rows", rows)


    res.json({ items: rows });
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).json({ message: 'Error fetching cart items' });
  }
};


// Method to clear the cart for a specific user
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
  console.log("Removing item with:", { userId, productId, size });

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

    // Log the result for debugging
    console.log('Query Result:', result);

    // Check if any rows were affected
    console.log('Affected Rows:', result.affectedRows);
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
