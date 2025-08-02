const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');
const Product = require('../models/product'); 
const Category = require('../models/category');
const SubCategory = require('../models/subCategory');

const generateSitemap = async (req, res) => {
    try { 
        const links = [
                { url: '/', changefreq: 'daily', priority: 1.0 },
                { url: '/shop', changefreq: 'weekly', priority: 0.8 },
                { url: '/cart', changefreq: 'monthly', priority: 0.5 },
                { url: '/login', changefreq: 'monthly', priority: 0.3 },
                { url: '/signup', changefreq: 'monthly', priority: 0.3 },
                { url: '/contact', changefreq: 'monthly', priority: 0.3 },
                { url: '/about', changefreq: 'monthly', priority: 0.3 },
                { url: '/privacy-policy', changefreq: 'monthly', priority: 0.3 },
                { url: '/terms-and-conditions', changefreq: 'monthly', priority: 0.3 },
                { url: '/refund-policy', changefreq: 'monthly', priority: 0.3 },
                { url: '/shipping-policy', changefreq: 'monthly', priority: 0.3 },
                { url: '/return-policy', changefreq: 'monthly', priority: 0.3 },
                
            // Add other static pages here
        ];   
        // Fetch dynamic product URLs
        const products = await Product.find({}, 'slug updatedAt images'); // Fetch only slug and updatedAt fields
        products.forEach(product => {
            links.push({ 
                url: `/product/${product.slug}`,
                changefreq: 'weekly',
                priority: 0.7,
                lastmod: product.updatedAt,
                img: product.images?.map(imgUrl => ({ url: imgUrl })) // adjust as per your schema
            }); 
        });

        // Fetch categories
        const categories = await Category.find({}, 'slug');
        categories.forEach(category => {
            links.push({
                url: `/category/${category.slug}`,
                changefreq: 'weekly',
                priority: 0.7,
            });
        });

        // Fetch subcategories
        const subcategories = await SubCategory.find({}, 'slug parentCategorySlug');
        subcategories.forEach(sub => {
            links.push({
                url: `/category/${sub.parentCategorySlug}/${sub.slug}`,
                changefreq: 'weekly',
                priority: 0.6,
            });
        });

        // Use production domain for sitemap URLs
        const hostname = process.env.NODE_ENV === 'production' 
            ? 'https://etimadmart.com' 
            : `${req.protocol}://${req.get('host')}`;
        
        const sitemapStream = new SitemapStream({ hostname });

        // Set the content type header before piping the stream
        res.setHeader('Content-Type', 'application/xml');

        // Pipe the sitemap stream directly to the response
        sitemapStream.pipe(res);

        // Write links to the sitemap stream
        for (const link of links) {
            sitemapStream.write(link);
        }
        sitemapStream.end();

        console.log("Sitemap generation initiated.");

    } catch (error) {
        console.error("Error generating sitemap:", error);
        // Only send error response if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate sitemap' });
        }
    }
};

module.exports =  generateSitemap ;