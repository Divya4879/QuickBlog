const express = require('express');
const redis = require('redis');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:5501', 'http://localhost:5501'],
    credentials: true
}));
app.use(express.json());

// Redis client setup
const client = redis.createClient({
    url: 'redis://default:0lFESlhsABWVJAq1ANCN2nVl9JQ2Se9o@redis-14395.c9.us-east-1-4.ec2.cloud.redislabs.com:14395'
});

client.on('error', (err) => console.log('Redis Client Error', err));

// Connect to Redis
async function connectRedis() {
    try {
        await client.connect();
        console.log('✅ Connected to Redis Cloud');
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
    }
}

// Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Check if user exists
        const existingUser = await client.get(`user:${username}`);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Store user
        const userData = {
            password_hash: hashedPassword,
            created_at: new Date().toISOString()
        };
        
        await client.set(`user:${username}`, JSON.stringify(userData));
        await client.set(`user_blogs:${username}`, JSON.stringify([]));
        
        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Get user data
        const userData = await client.get(`user:${username}`);
        if (!userData) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = JSON.parse(userData);
        
        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        res.json({ success: true, username, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/blogs', async (req, res) => {
    try {
        const { username, title, content, category, tags } = req.body;
        
        // Validate word count
        const wordCount = content.trim().split(/\s+/).length;
        if (wordCount < 100) {
            return res.status(400).json({ error: 'Content must be at least 100 words' });
        }
        if (wordCount > 3000) {
            return res.status(400).json({ error: 'Content must not exceed 3000 words' });
        }
        
        // Validate tags
        if (tags && tags.length > 4) {
            return res.status(400).json({ error: 'Maximum 4 tags allowed' });
        }
        
        const blogId = Date.now().toString();
        const blogData = {
            id: blogId,
            title,
            content,
            category,
            tags: tags || [],
            author: username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Store blog with slug for SEO-friendly URLs
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        await client.set(`blog:${username}:${blogId}`, JSON.stringify(blogData));
        await client.set(`blog_slug:${slug}`, JSON.stringify({ username, blogId }));
        
        // Update user's blog list
        const userBlogsData = await client.get(`user_blogs:${username}`);
        const userBlogs = userBlogsData ? JSON.parse(userBlogsData) : [];
        userBlogs.push(blogId);
        await client.set(`user_blogs:${username}`, JSON.stringify(userBlogs));
        
        res.json({ 
            success: true, 
            blogId, 
            shareableLink: `http://localhost:3001/article/${slug}`,
            message: 'Blog published successfully' 
        });
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(500).json({ error: 'Failed to create blog' });
    }
});

app.get('/api/blogs/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const userBlogsData = await client.get(`user_blogs:${username}`);
        const userBlogs = userBlogsData ? JSON.parse(userBlogsData) : [];
        
        const blogs = [];
        for (const blogId of userBlogs) {
            const blogData = await client.get(`blog:${username}:${blogId}`);
            if (blogData) {
                blogs.push(JSON.parse(blogData));
            }
        }
        
        res.json({ success: true, blogs });
    } catch (error) {
        console.error('Get blogs error:', error);
        res.status(500).json({ error: 'Failed to get blogs' });
    }
});

app.delete('/api/blogs/:username/:blogId', async (req, res) => {
    try {
        const { username, blogId } = req.params;
        
        // Delete the blog
        await client.del(`blog:${username}:${blogId}`);
        
        // Remove from user's blog list
        const userBlogsData = await client.get(`user_blogs:${username}`);
        const userBlogs = userBlogsData ? JSON.parse(userBlogsData) : [];
        const updatedBlogs = userBlogs.filter(id => id !== blogId);
        await client.set(`user_blogs:${username}`, JSON.stringify(updatedBlogs));
        
        res.json({ success: true, message: 'Blog deleted successfully' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ error: 'Failed to delete blog' });
    }
});

app.put('/api/blogs/:username/:blogId', async (req, res) => {
    try {
        const { username, blogId } = req.params;
        const { title, content, category } = req.body;
        
        // Get existing blog
        const existingBlogData = await client.get(`blog:${username}:${blogId}`);
        if (!existingBlogData) {
            return res.status(404).json({ error: 'Blog not found' });
        }
        
        const existingBlog = JSON.parse(existingBlogData);
        
        // Update blog data
        const updatedBlog = {
            ...existingBlog,
            title: title || existingBlog.title,
            content: content || existingBlog.content,
            category: category || existingBlog.category,
            updated_at: new Date().toISOString()
        };
        
        await client.set(`blog:${username}:${blogId}`, JSON.stringify(updatedBlog));
        
        res.json({ 
            success: true, 
            blog: updatedBlog,
            message: 'Blog updated successfully' 
        });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ error: 'Failed to update blog' });
    }
});

app.get('/article/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        // Get blog info from slug
        const slugData = await client.get(`blog_slug:${slug}`);
        if (!slugData) {
            return res.status(404).send('Article not found');
        }
        
        const { username, blogId } = JSON.parse(slugData);
        const blogData = await client.get(`blog:${username}:${blogId}`);
        if (!blogData) {
            return res.status(404).send('Article not found');
        }
        
        const blog = JSON.parse(blogData);
        
        // Enhanced HTML with dark/light mode
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${blog.title} - QuickBlog</title>
            <meta name="description" content="${blog.content.substring(0, 160)}...">
            <meta property="og:title" content="${blog.title}">
            <meta property="og:description" content="${blog.content.substring(0, 160)}...">
            <meta property="og:type" content="article">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary: #3b82f6;
                    --secondary: #10b981;
                    --accent: #ec4899;
                    --text-primary: #0f172a;
                    --text-secondary: #475569;
                    --text-tertiary: #64748b;
                    --text-inverse: #ffffff;
                    --bg-primary: #ffffff;
                    --bg-secondary: #f8fafc;
                    --bg-tertiary: #f1f5f9;
                    --border: #e2e8f0;
                    --gradient: linear-gradient(135deg, #3b82f6 0%, #10b981 50%, #ec4899 100%);
                    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                    --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                [data-theme="dark"] {
                    --text-primary: #f8fafc;
                    --text-secondary: #cbd5e1;
                    --text-tertiary: #94a3b8;
                    --bg-primary: #0f172a;
                    --bg-secondary: #1e293b;
                    --bg-tertiary: #334155;
                    --border: #334155;
                    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                    --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
                }
                
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    line-height: 1.7;
                    color: var(--text-primary);
                    background: var(--bg-secondary);
                    transition: var(--transition);
                }
                
                .navbar {
                    position: fixed;
                    top: 0;
                    width: 100%;
                    z-index: 1000;
                    padding: 1rem 0;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(20px) saturate(180%);
                    border-bottom: 1px solid var(--border);
                    transition: var(--transition);
                }
                
                [data-theme="dark"] .navbar {
                    background: rgba(15, 23, 42, 0.85);
                }
                
                .nav-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .nav-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--text-primary);
                    text-decoration: none;
                }
                
                .nav-links {
                    display: flex;
                    gap: 2rem;
                    align-items: center;
                }
                
                .nav-link {
                    color: var(--text-secondary);
                    text-decoration: none;
                    font-weight: 500;
                    transition: var(--transition);
                }
                
                .nav-link:hover {
                    color: var(--primary);
                }
                
                .theme-toggle {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border);
                    border-radius: 2rem;
                    padding: 0.5rem;
                    cursor: pointer;
                    transition: var(--transition);
                    font-size: 1.25rem;
                }
                
                .theme-toggle:hover {
                    background: var(--bg-primary);
                }
                
                .btn-primary {
                    background: var(--gradient);
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 2rem;
                    text-decoration: none;
                    font-weight: 600;
                    transition: var(--transition);
                }
                
                .btn-primary:hover {
                    transform: translateY(-2px);
                }
                
                .article-container {
                    max-width: 800px;
                    margin: 6rem auto 2rem;
                    background: var(--bg-primary);
                    border-radius: 1rem;
                    overflow: hidden;
                    box-shadow: var(--shadow-lg);
                    transition: var(--transition);
                }
                
                .article-header {
                    padding: 3rem 3rem 2rem;
                    background: var(--gradient);
                    color: white;
                    position: relative;
                }
                
                .article-category {
                    display: inline-block;
                    background: rgba(255,255,255,0.2);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 1.5rem;
                    text-transform: capitalize;
                }
                
                .article-title {
                    font-size: clamp(2rem, 5vw, 3rem);
                    font-weight: 800;
                    line-height: 1.2;
                    margin-bottom: 1.5rem;
                }
                
                .article-meta {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    flex-wrap: wrap;
                }
                
                .author-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .author-avatar {
                    width: 3rem;
                    height: 3rem;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1.25rem;
                    border: 2px solid rgba(255,255,255,0.3);
                }
                
                .author-details h3 {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }
                
                .article-stats {
                    display: flex;
                    gap: 1.5rem;
                    font-size: 0.875rem;
                    opacity: 0.9;
                }
                
                .article-content {
                    padding: 3rem;
                }
                
                .article-tags {
                    display: flex;
                    gap: 0.75rem;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                }
                
                .tag {
                    background: var(--bg-secondary);
                    color: var(--primary);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    border: 1px solid var(--border);
                    transition: var(--transition);
                }
                
                .article-body {
                    font-size: 1.125rem;
                    line-height: 1.8;
                    color: var(--text-primary);
                }
                
                .article-body p {
                    margin-bottom: 1.5rem;
                }
                
                .article-footer {
                    padding: 2rem 3rem;
                    border-top: 1px solid var(--border);
                    background: var(--bg-secondary);
                }
                
                .footer-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                
                .share-text {
                    color: var(--text-secondary);
                }
                
                @media (max-width: 768px) {
                    .nav-links { gap: 1rem; }
                    .nav-link:not(.btn-primary) { display: none; }
                    .article-container { margin: 5rem 1rem 2rem; }
                    .article-header { padding: 2rem; }
                    .article-content { padding: 2rem; }
                    .article-footer { padding: 2rem; }
                    .footer-content { flex-direction: column; text-align: center; }
                }
            </style>
        </head>
        <body>
            <nav class="navbar">
                <div class="nav-container">
                    <a href="http://localhost:8000" class="nav-brand">
                        <span>✍️</span>
                        <span>QuickBlog</span>
                    </a>
                    <div class="nav-links">
                        <a href="http://localhost:8000" class="nav-link">Home</a>
                        <a href="http://localhost:8000#blogs" class="nav-link">Discover</a>
                        <a href="http://localhost:8000#create" class="nav-link">Create</a>
                        <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
                        <a href="http://localhost:8000" class="btn-primary">Start Writing</a>
                    </div>
                </div>
            </nav>

            <article class="article-container">
                <header class="article-header">
                    <div class="article-category">${blog.category}</div>
                    <h1 class="article-title">${blog.title}</h1>
                    <div class="article-meta">
                        <div class="author-info">
                            <div class="author-avatar">${blog.author.charAt(0).toUpperCase()}</div>
                            <div class="author-details">
                                <h3>${blog.author}</h3>
                                <div>${new Date(blog.created_at).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}</div>
                            </div>
                        </div>
                        <div class="article-stats">
                            <span>${Math.ceil(blog.content.split(' ').length / 200)} min read</span>
                            <span>${blog.content.split(' ').length} words</span>
                        </div>
                    </div>
                </header>
                
                <div class="article-content">
                    ${blog.tags && blog.tags.length > 0 ? `
                        <div class="article-tags">
                            ${blog.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="article-body">
                        ${blog.content.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}
                    </div>
                </div>
                
                <footer class="article-footer">
                    <div class="footer-content">
                        <div class="share-text">Published on QuickBlog - Terminal-first blogging</div>
                        <a href="http://localhost:8000" class="btn-primary">Create Your Blog</a>
                    </div>
                </footer>
            </article>

            <script>
                function toggleTheme() {
                    const html = document.documentElement;
                    const themeToggle = document.querySelector('.theme-toggle');
                    const currentTheme = html.getAttribute('data-theme');
                    
                    if (currentTheme === 'dark') {
                        html.removeAttribute('data-theme');
                        themeToggle.textContent = '🌙';
                        localStorage.setItem('article_theme', 'light');
                    } else {
                        html.setAttribute('data-theme', 'dark');
                        themeToggle.textContent = '☀️';
                        localStorage.setItem('article_theme', 'dark');
                    }
                }

                // Load saved theme
                document.addEventListener('DOMContentLoaded', () => {
                    const savedTheme = localStorage.getItem('article_theme');
                    const themeToggle = document.querySelector('.theme-toggle');
                    
                    if (savedTheme === 'dark') {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        themeToggle.textContent = '☀️';
                    }
                });
            </script>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        console.error('Get article error:', error);
        res.status(500).send('Error loading article');
    }
});

app.get('/blog/:username/:blogId', async (req, res) => {
    try {
        const { username, blogId } = req.params;
        
        const blogData = await client.get(`blog:${username}:${blogId}`);
        if (!blogData) {
            return res.status(404).send('Blog not found');
        }
        
        const blog = JSON.parse(blogData);
        
        // Beautiful shareable article page matching website styling
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${blog.title} - QuickBlog</title>
            <meta name="description" content="${blog.content.substring(0, 160)}...">
            <meta property="og:title" content="${blog.title}">
            <meta property="og:description" content="${blog.content.substring(0, 160)}...">
            <meta property="og:type" content="article">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary: #3b82f6;
                    --secondary: #10b981;
                    --accent: #ec4899;
                    --text-primary: #0f172a;
                    --text-secondary: #475569;
                    --text-tertiary: #64748b;
                    --bg-primary: #ffffff;
                    --bg-secondary: #f8fafc;
                    --border: #e2e8f0;
                    --gradient: linear-gradient(135deg, #3b82f6 0%, #10b981 50%, #ec4899 100%);
                    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }
                
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    line-height: 1.7;
                    color: var(--text-primary);
                    background: var(--bg-secondary);
                }
                
                /* Navigation matching main site */
                .navbar {
                    position: fixed;
                    top: 0;
                    width: 100%;
                    z-index: 1000;
                    padding: 1rem 0;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(20px) saturate(180%);
                    border-bottom: 1px solid var(--border);
                }
                
                .nav-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .nav-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--text-primary);
                    text-decoration: none;
                }
                
                .nav-links {
                    display: flex;
                    gap: 2rem;
                    align-items: center;
                }
                
                .nav-link {
                    color: var(--text-secondary);
                    text-decoration: none;
                    font-weight: 500;
                    transition: color 0.2s;
                }
                
                .nav-link:hover {
                    color: var(--primary);
                }
                
                .btn-primary {
                    background: var(--gradient);
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 2rem;
                    text-decoration: none;
                    font-weight: 600;
                    transition: transform 0.2s;
                }
                
                .btn-primary:hover {
                    transform: translateY(-2px);
                }
                
                /* Article content */
                .article-container {
                    max-width: 800px;
                    margin: 6rem auto 0;
                    background: var(--bg-primary);
                    border-radius: 1rem;
                    overflow: hidden;
                    box-shadow: var(--shadow-lg);
                }
                
                .article-header {
                    padding: 3rem 3rem 2rem;
                    background: var(--gradient);
                    color: white;
                    position: relative;
                }
                
                .article-category {
                    display: inline-block;
                    background: rgba(255,255,255,0.2);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 1.5rem;
                    text-transform: capitalize;
                }
                
                .article-title {
                    font-size: clamp(2rem, 5vw, 3rem);
                    font-weight: 800;
                    line-height: 1.2;
                    margin-bottom: 1.5rem;
                }
                
                .article-meta {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    flex-wrap: wrap;
                }
                
                .author-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .author-avatar {
                    width: 3rem;
                    height: 3rem;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1.25rem;
                    border: 2px solid rgba(255,255,255,0.3);
                }
                
                .author-details h3 {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }
                
                .article-stats {
                    display: flex;
                    gap: 1.5rem;
                    font-size: 0.875rem;
                    opacity: 0.9;
                }
                
                .article-content {
                    padding: 3rem;
                }
                
                .article-tags {
                    display: flex;
                    gap: 0.75rem;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                }
                
                .tag {
                    background: var(--bg-secondary);
                    color: var(--primary);
                    padding: 0.5rem 1rem;
                    border-radius: 2rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    border: 1px solid var(--border);
                }
                
                .article-body {
                    font-size: 1.125rem;
                    line-height: 1.8;
                    color: var(--text-primary);
                }
                
                .article-body p {
                    margin-bottom: 1.5rem;
                }
                
                .article-footer {
                    padding: 2rem 3rem;
                    border-top: 1px solid var(--border);
                    background: var(--bg-secondary);
                    text-align: center;
                }
                
                .footer-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                
                .share-text {
                    color: var(--text-secondary);
                }
                
                @media (max-width: 768px) {
                    .nav-links { display: none; }
                    .article-container { margin: 5rem 1rem 0; }
                    .article-header { padding: 2rem; }
                    .article-content { padding: 2rem; }
                    .article-footer { padding: 2rem; }
                    .footer-content { flex-direction: column; text-align: center; }
                }
            </style>
        </head>
        <body>
            <!-- Navigation matching main site -->
            <nav class="navbar">
                <div class="nav-container">
                    <a href="http://localhost:8000" class="nav-brand">
                        <span>✍️</span>
                        <span>QuickBlog</span>
                    </a>
                    <div class="nav-links">
                        <a href="http://localhost:8000" class="nav-link">Home</a>
                        <a href="http://localhost:8000#blogs" class="nav-link">Discover</a>
                        <a href="http://localhost:8000#create" class="nav-link">Create</a>
                        <a href="http://localhost:8000" class="btn-primary">Start Writing</a>
                    </div>
                </div>
            </nav>

            <!-- Article content -->
            <article class="article-container">
                <header class="article-header">
                    <div class="article-category">${blog.category}</div>
                    <h1 class="article-title">${blog.title}</h1>
                    <div class="article-meta">
                        <div class="author-info">
                            <div class="author-avatar">${blog.author.charAt(0).toUpperCase()}</div>
                            <div class="author-details">
                                <h3>${blog.author}</h3>
                                <div>${new Date(blog.created_at).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}</div>
                            </div>
                        </div>
                        <div class="article-stats">
                            <span>${Math.ceil(blog.content.split(' ').length / 200)} min read</span>
                            <span>${blog.content.split(' ').length} words</span>
                        </div>
                    </div>
                </header>
                
                <div class="article-content">
                    ${blog.tags && blog.tags.length > 0 ? `
                        <div class="article-tags">
                            ${blog.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="article-body">
                        ${blog.content.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}
                    </div>
                </div>
                
                <footer class="article-footer">
                    <div class="footer-content">
                        <div class="share-text">Published on QuickBlog - Terminal-first blogging platform</div>
                        <a href="http://localhost:8000" class="btn-primary">Create Your Blog</a>
                    </div>
                </footer>
            </article>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        console.error('Get blog error:', error);
        res.status(500).send('Error loading blog');
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await client.ping();
        res.json({ status: 'healthy', redis: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', redis: 'disconnected' });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'QuickBlog API Server', status: 'running' });
});

// Start server
async function startServer() {
    await connectRedis();
    app.listen(PORT, () => {
        console.log(`🚀 QuickBlog API running on http://localhost:${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
}

startServer();
