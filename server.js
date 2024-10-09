require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors')
const axios = require('axios');
const Product = require('./models/product');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT;

app.use(cors())

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('mongodb connected'))
    .catch((err) => console.log("error connected :", err))

app.use(express.json());

app.get('/api/initialize-db', async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const products = response.data;

        await Product.deleteMany({});
        await Product.insertMany(products);

        res.json({ message: 'Database initialized successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error initializing database' });
    }
});

app.use('/api', productRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});