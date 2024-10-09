const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const axios = require('axios')

const getMonthDateRange = (month) => {
    const startDate = new Date(2020, month - 1, 1); // 2020 as base year
    const endDate = new Date(2025, month, 0); // 2100 as end year
    return { startDate, endDate };
};

//Transactions
router.get('/transactions', async (req, res) => {
    const { month, search, page = 1, perPage = 10 } = req.query;
    const { startDate, endDate } = getMonthDateRange(parseInt(month));

    let query = {
        $expr: {
            $and: [
                { $eq: [{ $month: '$dateOfSale' }, parseInt(month)] },
                { $gte: ['$dateOfSale', startDate] },
                { $lte: ['$dateOfSale', endDate] }
            ]
        }
    };

    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { price: parseFloat(search) || 0 }
        ];
    }

    try {
        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .skip((page - 1) * perPage)
            .limit(parseInt(perPage));

        res.json({
            total,
            page: parseInt(page),
            perPage: parseInt(perPage),
            products
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching transactions' });
    }
});

// Statistics
router.get('/statistics', async (req, res) => {
    const { month } = req.query;
    const { startDate, endDate } = getMonthDateRange(parseInt(month));

    try {
        const statistics = await Product.aggregate([
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: [{ $month: '$dateOfSale' }, parseInt(month)] },
                            { $gte: ['$dateOfSale', startDate] },
                            { $lte: ['$dateOfSale', endDate] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSaleAmount: { $sum: { $cond: [{ $eq: ['$sold', true] }, '$price', 0] } },
                    totalSoldItems: { $sum: { $cond: [{ $eq: ['$sold', true] }, 1, 0] } },
                    totalNotSoldItems: { $sum: { $cond: [{ $eq: ['$sold', false] }, 1, 0] } }
                }
            }
        ]);

        res.json(statistics[0] || { totalSaleAmount: 0, totalSoldItems: 0, totalNotSoldItems: 0 });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching statistics' });
    }
});

// Bar chart data
router.get('/bar-chart', async (req, res) => {
    const { month } = req.query;
    const { startDate, endDate } = getMonthDateRange(parseInt(month));

    try {
        const ranges = [
            { min: 0, max: 100 },
            { min: 101, max: 200 },
            { min: 201, max: 300 },
            { min: 301, max: 400 },
            { min: 401, max: 500 },
            { min: 501, max: 600 },
            { min: 601, max: 700 },
            { min: 701, max: 800 },
            { min: 801, max: 900 },
            { min: 901, max: Infinity }
        ];

        const barChartData = await Promise.all(ranges.map(async (range) => {
            const count = await Product.countDocuments({
                dateOfSale: { $gte: startDate, $lte: endDate },
                price: { $gte: range.min, $lt: range.max === Infinity ? undefined : range.max }
            });
            return {
                range: `${range.min} - ${range.max === Infinity ? 'above' : range.max}`,
                count
            };
        }));

        res.json(barChartData);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching bar chart data' });
    }
});


// Pie chart data
router.get('/pie-chart', async (req, res) => {
    const { month } = req.query;
    const { startDate, endDate } = getMonthDateRange(parseInt(month));

    try {
        const pieChartData = await Product.aggregate([
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: [{ $month: '$dateOfSale' }, parseInt(month)] },
                            { $gte: ['$dateOfSale', startDate] },
                            { $lte: ['$dateOfSale', endDate] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json(pieChartData);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching pie chart data' });
    }
});

// Combined data
router.get('/combined-data', async (req, res) => {
    const { month } = req.query;

    try {
        const [transactions, statistics, barChart, pieChart] = await Promise.all([
            axios.get(`http://localhost:${process.env.PORT}/api/transactions?month=${month}`),
            axios.get(`http://localhost:${process.env.PORT}/api/statistics?month=${month}`),
            axios.get(`http://localhost:${process.env.PORT}/api/bar-chart?month=${month}`),
            axios.get(`http://localhost:${process.env.PORT}/api/pie-chart?month=${month}`)
        ]);

        res.json({
            transactions: transactions.data,
            statistics: statistics.data,
            barChartData: barChart.data,
            pieChartData: pieChart.data
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching combined data' });
    }
});

module.exports = router;