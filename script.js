// QuickBlog - Premium Blog Platform with Redis Cloud
class QuickBlog {
    constructor() {
        this.currentUser = localStorage.getItem('quickblog_user');
        this.currentTheme = localStorage.getItem('quickblog_theme') || 'light';
        // Auto-detect environment for API endpoint
        this.apiEndpoint = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : `${window.location.origin}/api`;
        this.isAuthMode = 'login';
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.loadSampleBlogs();
        this.updateUI();
        this.setupScrollEffects();
    }

    setupTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        const themeIcon = document.querySelector('.theme-icon');
        themeIcon.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.showSection(section);
                this.updateActiveNav(section);
            });
        });

        // Hero CTA
        document.getElementById('startWriting').addEventListener('click', () => {
            if (this.currentUser) {
                this.showSection('create');
                this.updateActiveNav('create');
            } else {
                this.showAuthModal();
            }
        });

        // Final CTA
        document.getElementById('finalCTA').addEventListener('click', () => {
            if (this.currentUser) {
                this.showSection('create');
                this.updateActiveNav('create');
            } else {
                this.showAuthModal();
            }
        });

        // Auth modal
        document.getElementById('loginBtn').addEventListener('click', () => {
            if (this.currentUser) {
                this.showUserMenu();
            } else {
                this.showAuthModal();
            }
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideAuthModal();
        });

        document.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.hideAuthModal();
        });

        document.getElementById('switchAuth').addEventListener('click', () => {
            this.toggleAuthMode();
        });

        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        // Blog form
        document.getElementById('blogForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBlogSubmit();
        });

        document.getElementById('saveDraft').addEventListener('click', () => {
            this.saveDraft();
        });

        // Word counter
        document.getElementById('blogContent').addEventListener('input', (e) => {
            this.updateWordCount(e.target.value);
        });

        // Tag selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-option')) {
                this.toggleTag(e.target);
            }
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterBlogs(e.target.dataset.filter);
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    setupScrollEffects() {
        const navbar = document.querySelector('.navbar');
        let lastScroll = 0;
        let ticking = false;

        const updateNavbar = () => {
            const currentScroll = window.pageYOffset;
            
            // Only hide navbar when scrolling down fast and past hero
            if (currentScroll > lastScroll && currentScroll > 800 && Math.abs(currentScroll - lastScroll) > 5) {
                navbar.style.transform = 'translateY(-100%)';
            } else if (currentScroll < lastScroll || currentScroll <= 100) {
                navbar.style.transform = 'translateY(0)';
            }
            
            lastScroll = currentScroll;
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        });

        // Setup FAQ toggles
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', () => {
                const faqItem = question.parentElement;
                const isActive = faqItem.classList.contains('active');
                
                // Close all other FAQs
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                // Toggle current FAQ
                if (!isActive) {
                    faqItem.classList.add('active');
                }
            });
        });
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('quickblog_theme', this.currentTheme);
        this.setupTheme();
        
        // Add transition effect
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    showSection(sectionId) {
        document.querySelectorAll('main > section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(sectionId).style.display = 'block';
        
        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateActiveNav(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    }

    showAuthModal() {
        document.getElementById('authModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    hideAuthModal() {
        document.getElementById('authModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    toggleAuthMode() {
        this.isAuthMode = this.isAuthMode === 'login' ? 'register' : 'login';
        const title = document.getElementById('modalTitle');
        const subtitle = document.getElementById('modalSubtitle');
        const switchText = document.getElementById('switchAuth');
        const submitBtn = document.querySelector('#authForm button');

        if (this.isAuthMode === 'register') {
            title.textContent = 'Join QuickBlog';
            subtitle.textContent = 'Start your writing journey today';
            submitBtn.textContent = 'Create Account';
            switchText.textContent = 'Sign in instead';
        } else {
            title.textContent = 'Welcome Back';
            subtitle.textContent = 'Sign in to continue your journey';
            submitBtn.textContent = 'Sign In';
            switchText.textContent = 'Create account';
        }
    }

    async handleAuth() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        const submitBtn = document.querySelector('#authForm button');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        try {
            let success = false;
            if (this.isAuthMode === 'register') {
                success = await this.register(username, password);
                if (success) {
                    success = await this.login(username, password);
                }
            } else {
                success = await this.login(username, password);
            }

            if (success) {
                this.hideAuthModal();
                this.updateUI();
                this.showNotification(`Welcome ${this.isAuthMode === 'register' ? 'to QuickBlog' : 'back'}, ${username}!`, 'success');
                document.getElementById('authForm').reset();
            } else {
                this.showNotification('Authentication failed. Please try again.', 'error');
            }
        } catch (error) {
            this.showNotification('Connection error. Please try again.', 'error');
        }

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }

    async handleBlogSubmit() {
        if (!this.currentUser) {
            this.showAuthModal();
            return;
        }

        const title = document.getElementById('blogTitle')?.value?.trim() || '';
        const content = document.getElementById('blogContent')?.value?.trim() || '';
        const category = document.getElementById('blogCategory')?.value || 'tech';
        const tagsInput = document.getElementById('blogTags');
        
        // Parse tags from hidden input
        const tags = tagsInput?.value ? tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        if (!title || !content) {
            this.showNotification('Please fill in title and content', 'error');
            return;
        }

        // Validate word count
        const wordCount = content.split(/\s+/).length;
        if (wordCount < 100) {
            this.showNotification('Content must be at least 100 words', 'error');
            return;
        }
        if (wordCount > 3000) {
            this.showNotification('Content must not exceed 3000 words', 'error');
            return;
        }

        let success = false;
        if (this.editingBlogId) {
            // Update existing blog
            success = await this.updateBlog(this.editingBlogId, title, content, category, tags);
            this.editingBlogId = null;
            document.querySelector('#blogForm button[type="submit"]').textContent = 'Publish Story';
        } else {
            // Create new blog
            success = await this.createBlog(title, content, category, tags);
        }

        if (success) {
            document.getElementById('blogForm')?.reset();
            const tagsInput = document.getElementById('blogTags');
            if (tagsInput) tagsInput.value = '';
            document.querySelectorAll('.tag-option.selected').forEach(tag => {
                tag.classList.remove('selected');
            });
            this.updateWordCount('');
            this.updateTagCounter();
            this.loadSampleBlogs(); // Refresh blogs
        }
    }

    saveDraft() {
        const title = document.getElementById('blogTitle').value.trim();
        const content = document.getElementById('blogContent').value.trim();
        
        if (title || content) {
            localStorage.setItem('quickblog_draft', JSON.stringify({ title, content }));
            this.showNotification('Draft saved locally', 'success');
        }
    }

    loadSampleBlogs() {
        const blogsGrid = document.getElementById('blogsGrid');
        
        // Show loading skeletons
        setTimeout(async () => {
            if (this.currentUser) {
                // Load user's blogs
                const userBlogs = await this.getUserBlogs();
                this.renderBlogs(userBlogs, true); // true = show edit/delete buttons
            } else {
                // Show sample blogs for non-logged users
                const sampleBlogs = [
                    {
                        id: 1,
                        title: "The Future of Web Development: What's Next?",
                        content: "Exploring emerging technologies, frameworks, and methodologies that are shaping the future of web development. From AI-powered coding assistants to serverless architectures, discover what's coming next in our industry.",
                        author: "Sarah Chen",
                        category: "tech",
                        created_at: "2024-12-24T10:00:00Z",
                        readTime: "5 min read",
                        likes: 234
                    },
                    {
                        id: 2,
                        title: "Design Systems That Scale: Lessons from Industry Leaders",
                        content: "How companies like Airbnb, Shopify, and Atlassian built design systems that support thousands of designers and developers. Learn the principles, tools, and processes that make design systems successful at scale.",
                        author: "Marcus Rodriguez",
                        category: "design",
                        created_at: "2024-12-23T15:30:00Z",
                        readTime: "8 min read",
                        likes: 189
                    }
                ];
                this.renderBlogs(sampleBlogs, false);
            }
        }, 1500);
    }

    renderBlogs(blogs, showActions = false) {
        const blogsGrid = document.getElementById('blogsGrid');
        
        if (blogs.length === 0) {
            blogsGrid.innerHTML = `
                <div class="no-blogs">
                    <h3>No stories found</h3>
                    <p>Be the first to share your story with the world!</p>
                </div>
            `;
            return;
        }

        blogsGrid.innerHTML = blogs.map(blog => `
            <article class="blog-card" data-category="${blog.category}" onclick="window.quickBlog.openArticle('${blog.author || this.currentUser}', '${blog.id}')" style="cursor: pointer;">
                <div class="blog-header">
                    <span class="blog-category">${this.formatCategory(blog.category)}</span>
                    <span class="blog-read-time">${blog.readTime || '3 min read'}</span>
                </div>
                <h3 class="blog-title">${this.escapeHtml(blog.title)}</h3>
                <p class="blog-excerpt">${this.escapeHtml(blog.content.substring(0, 150))}...</p>
                <div class="blog-footer">
                    <div class="blog-author">
                        <div class="author-avatar">${(blog.author || this.currentUser || 'A').charAt(0)}</div>
                        <div class="author-info">
                            <div class="author-name">${this.escapeHtml(blog.author || this.currentUser || 'Anonymous')}</div>
                            <div class="blog-date">${this.formatDate(blog.created_at)}</div>
                        </div>
                    </div>
                    <div class="blog-stats">
                        ${showActions ? `
                            <button class="btn-edit" onclick="event.stopPropagation(); window.quickBlog.editBlog('${blog.id}')">Edit</button>
                            <button class="btn-delete" onclick="event.stopPropagation(); window.quickBlog.deleteBlog('${blog.id}')">Delete</button>
                        ` : `<span class="blog-likes">❤️ ${blog.likes || 0}</span>`}
                    </div>
                </div>
            </article>
        `).join('');

        // Add blog card styles
        this.addBlogCardStyles();
    }

    addBlogCardStyles() {
        if (document.getElementById('blog-card-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'blog-card-styles';
        style.textContent = `
            .blog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            
            .blog-category {
                background: var(--primary);
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 1rem;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
            }
            
            .blog-read-time {
                color: var(--text-tertiary);
                font-size: 0.875rem;
            }
            
            .blog-title {
                font-size: 1.25rem;
                font-weight: 700;
                margin-bottom: 0.75rem;
                line-height: 1.4;
                color: var(--text-primary);
            }
            
            .blog-excerpt {
                color: var(--text-secondary);
                line-height: 1.6;
                margin-bottom: 1.5rem;
            }
            
            .blog-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .blog-author {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .author-avatar {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 50%;
                background: var(--gradient-primary);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 1rem;
            }
            
            .author-name {
                font-weight: 600;
                color: var(--text-primary);
                font-size: 0.875rem;
            }
            
            .blog-date {
                color: var(--text-tertiary);
                font-size: 0.75rem;
            }
            
            .blog-stats {
                color: var(--text-tertiary);
                font-size: 0.875rem;
            }
            
            .no-blogs {
                grid-column: 1 / -1;
                text-align: center;
                padding: 4rem 2rem;
                color: var(--text-secondary);
            }
            
            .btn-edit {
                background: var(--primary);
                color: white;
                border: none;
                padding: 0.25rem 0.75rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                cursor: pointer;
                margin-right: 0.5rem;
            }
            
            .btn-delete {
                background: #ef4444;
                color: white;
                border: none;
                padding: 0.25rem 0.75rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                cursor: pointer;
            }
            
            .btn-edit:hover, .btn-delete:hover {
                opacity: 0.8;
            }
        `;
        document.head.appendChild(style);
    }

    filterBlogs(category) {
        const blogCards = document.querySelectorAll('.blog-card');
        
        blogCards.forEach(card => {
            if (category === 'all' || card.dataset.category === category) {
                card.style.display = 'block';
                card.style.animation = 'fadeIn 0.3s ease';
            } else {
                card.style.display = 'none';
            }
        });
    }

    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        if (this.currentUser) {
            loginBtn.innerHTML = `
                <span>👋</span>
                <span>${this.currentUser}</span>
            `;
            loginBtn.classList.add('user-logged-in');
        } else {
            loginBtn.innerHTML = 'Sign In';
            loginBtn.classList.remove('user-logged-in');
        }
    }

    showUserMenu() {
        // Simple logout for now
        if (confirm('Do you want to sign out?')) {
            this.logout();
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('quickblog_user');
        this.updateUI();
        this.showNotification('Signed out successfully', 'success');
        this.showSection('home');
        this.updateActiveNav('home');
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }

    // API methods using Node.js backend
    async register(username, password) {
        try {
            const response = await fetch(`${this.apiEndpoint}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            return response.ok;
        } catch (error) {
            console.error('Register error:', error);
            return false;
        }
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.apiEndpoint}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (response.ok) {
                this.currentUser = username;
                localStorage.setItem('quickblog_user', username);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    async createBlog(title, content, category, tags) {
        if (!this.currentUser) return false;
        
        try {
            const response = await fetch(`${this.apiEndpoint}/blogs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.currentUser, title, content, category, tags })
            });
            const result = await response.json();
            if (response.ok) {
                console.log('Blog created! Shareable link:', result.shareableLink);
                this.showNotification(`Blog published! Link: ${result.shareableLink}`, 'success');
                return true;
            } else {
                this.showNotification(result.error || 'Failed to create blog', 'error');
                return false;
            }
        } catch (error) {
            console.error('Create blog error:', error);
            this.showNotification('Failed to create blog', 'error');
            return false;
        }
    }

    updateWordCount(content) {
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        const wordCountEl = document.getElementById('wordCount');
        
        wordCountEl.textContent = wordCount;
        wordCountEl.className = '';
        
        if (wordCount < 100) {
            wordCountEl.classList.add('error');
        } else if (wordCount > 2800) {
            wordCountEl.classList.add('warning');
        } else if (wordCount > 3000) {
            wordCountEl.classList.add('error');
        }
    }

    // Global function for tag suggestions
    addTag(tag) {
        const tagsInput = document.getElementById('blogTags');
        const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
        
        // Check if tag already exists
        if (currentTags.includes(tag)) {
            return;
        }
        
        // Check if we already have 4 tags
        if (currentTags.length >= 4) {
            this.showNotification('Maximum 4 tags allowed', 'warning');
            return;
        }
        
        // Add the tag
        const newTags = [...currentTags, tag];
        tagsInput.value = newTags.join(', ');
        
        // Update visual feedback
        this.updateTagChips();
    }

    toggleTag(tagElement) {
        const tag = tagElement.dataset.tag;
        const tagsInput = document.getElementById('blogTags');
        const currentTags = tagsInput.value ? tagsInput.value.split(',').map(t => t.trim()) : [];
        
        if (tagElement.classList.contains('selected')) {
            // Remove tag
            const newTags = currentTags.filter(t => t !== tag);
            tagsInput.value = newTags.join(',');
            tagElement.classList.remove('selected');
        } else {
            // Add tag if under limit
            if (currentTags.length >= 4) {
                this.showNotification('Maximum 4 tags allowed', 'warning');
                return;
            }
            currentTags.push(tag);
            tagsInput.value = currentTags.join(',');
            tagElement.classList.add('selected');
        }
        
        this.updateTagCounter();
    }

    updateTagCounter() {
        const tagsInput = document.getElementById('blogTags');
        const currentTags = tagsInput.value ? tagsInput.value.split(',').filter(t => t.trim()) : [];
        const counter = document.querySelector('.tag-counter');
        if (counter) {
            counter.textContent = `${currentTags.length}/4 tags selected`;
        }
    }

    openArticle(author, blogId) {
        // Try to get the blog title for SEO-friendly URL
        const blogs = this.currentUser === author ? this.getUserBlogs() : [];
        blogs.then(userBlogs => {
            const blog = userBlogs.find(b => b.id === blogId);
            if (blog) {
                const slug = blog.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const articleUrl = window.location.hostname === 'localhost'
                    ? `http://localhost:3001/article/${slug}`
                    : `${window.location.origin}/article/${slug}`;
                window.open(articleUrl, '_blank');
            } else {
                // Fallback to old URL format
                const articleUrl = window.location.hostname === 'localhost'
                    ? `http://localhost:3001/blog/${author}/${blogId}`
                    : `${window.location.origin}/blog/${author}/${blogId}`;
                window.open(articleUrl, '_blank');
            }
        }).catch(() => {
            // Fallback to old URL format
            const articleUrl = window.location.hostname === 'localhost'
                ? `http://localhost:3001/blog/${author}/${blogId}`
                : `${window.location.origin}/blog/${author}/${blogId}`;
            window.open(articleUrl, '_blank');
        });
    }

    async getUserBlogs() {
        if (!this.currentUser) return [];
        
        try {
            const response = await fetch(`${this.apiEndpoint}/blogs/${this.currentUser}`);
            const result = await response.json();
            return response.ok ? result.blogs : [];
        } catch (error) {
            console.error('Get blogs error:', error);
            return [];
        }
    }

    async deleteBlog(blogId) {
        if (!this.currentUser) return false;
        
        if (!confirm('Are you sure you want to delete this blog?')) return false;
        
        try {
            const response = await fetch(`${this.apiEndpoint}/blogs/${this.currentUser}/${blogId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                this.showNotification('Blog deleted successfully', 'success');
                this.loadSampleBlogs(); // Refresh the blog list
                return true;
            }
            return false;
        } catch (error) {
            console.error('Delete blog error:', error);
            this.showNotification('Failed to delete blog', 'error');
            return false;
        }
    }

    async editBlog(blogId) {
        if (!this.currentUser) return;
        
        // Get the blog data
        const blogs = await this.getUserBlogs();
        const blog = blogs.find(b => b.id === blogId);
        if (!blog) return;
        
        // Fill the form with existing data
        document.getElementById('blogTitle').value = blog.title;
        document.getElementById('blogContent').value = blog.content;
        document.getElementById('blogCategory').value = blog.category;
        
        // Switch to create section
        this.showSection('create');
        this.updateActiveNav('create');
        
        // Store the blog ID for updating
        this.editingBlogId = blogId;
        
        // Change button text
        const submitBtn = document.querySelector('#blogForm button[type="submit"]');
        submitBtn.textContent = 'Update Blog';
    }

    async updateBlog(blogId, title, content, category) {
        if (!this.currentUser) return false;
        
        try {
            const response = await fetch(`${this.apiEndpoint}/blogs/${this.currentUser}/${blogId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, category })
            });
            if (response.ok) {
                this.showNotification('Blog updated successfully', 'success');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Update blog error:', error);
            return false;
        }
    }

    // Utility methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatCategory(category) {
        const categories = {
            tech: 'Technology',
            design: 'Design',
            business: 'Business',
            lifestyle: 'Lifestyle'
        };
        return categories[category] || category;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.quickBlog = new QuickBlog();
    
    // Make addTag globally accessible
    window.addTag = (tag) => {
        window.quickBlog.addTag(tag);
    };
    
    // Load draft if exists
    const draft = localStorage.getItem('quickblog_draft');
    if (draft) {
        const { title, content } = JSON.parse(draft);
        document.getElementById('blogTitle').value = title || '';
        document.getElementById('blogContent').value = content || '';
    }
});

// Add fade in animation
const fadeInStyle = document.createElement('style');
fadeInStyle.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .user-logged-in {
        background: var(--gradient-secondary) !important;
    }
`;
document.head.appendChild(fadeInStyle);
