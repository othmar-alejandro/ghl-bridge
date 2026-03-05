const { chromium } = require('playwright');

/**
 * Converts an HTML string into a PDF buffer using Playwright (headless Chromium).
 * Optimized for perfect 8.5x11 inch PDF rendering with dark mode, gradients,
 * and Chart.js visualizations with zero margin/page-cut issues.
 */
async function generatePdf(htmlContent, businessName) {
    const browser = await chromium.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Prevent memory issues in containers
            '--font-render-hinting=none', // Better font rendering
        ]
    });

    try {
        const page = await browser.newPage();

        // Set viewport to match Letter size at 96 DPI (standard screen DPI)
        // 8.5 inches × 96 DPI = 816px width
        // 11 inches × 96 DPI = 1056px height
        await page.setViewportSize({ width: 816, height: 1056 });

        // Emulate print media for better CSS print rules support
        await page.emulateMedia({ media: 'print' });

        // Load HTML with extended timeout to ensure all CDN resources load
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle',
            timeout: 90000
        });

        // Critical: Wait for Chart.js to fully render
        // This ensures the radar chart is properly drawn before PDF conversion
        await page.waitForTimeout(3000);

        // Additional wait for fonts to load
        await page.evaluate(() => document.fonts.ready);

        // Generate PDF with optimal settings for production-quality output
        const pdfBuffer = await page.pdf({
            format: 'Letter', // Exactly 8.5 × 11 inches
            printBackground: true, // CRITICAL: Renders dark backgrounds, gradients, and box-shadows
            preferCSSPageSize: false, // Use our format, not CSS @page rules
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            displayHeaderFooter: false, // No Chromium-generated headers/footers
            scale: 1.0, // No scaling—maintain exact dimensions
        });

        const sizeKB = (pdfBuffer.length / 1024).toFixed(1);
        console.log(`[PDF] ✅ Generated PDF for "${businessName}" — ${sizeKB} KB`);
        return pdfBuffer;

    } catch (error) {
        console.error(`[PDF] ❌ Failed to generate PDF for "${businessName}":`, error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { generatePdf };
