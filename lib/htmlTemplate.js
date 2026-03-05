module.exports = function generateHtmlReport(data, lead) {
    const hasWebsite = lead.has_website !== 'No' && lead.has_website !== 'false' && lead.website_url;

    // Website Section — formatted for a full PDF page
    const websiteSectionHtml = hasWebsite ? `
        <div class="pdf-page">
            <div class="page-header">
                <h2><i class="fas fa-laptop-code"></i> Website Foundation & SEO</h2>
                <p>Is your storefront actually capturing leads, or just taking up space?</p>
            </div>
            
            <div class="content-box warning-box" style="margin-top: 40px;">
                <h3><i class="fas fa-search-dollar"></i> The Diagnosis</h3>
                <p style="font-size: 18px; line-height: 1.6;">${data.website_audit.diagnosis}</p>
            </div>
            
            <div class="grid-2" style="margin-top: 40px;">
                ${data.website_audit.issues.map(issue => `
                    <div class="content-box" style="border-left: 4px solid #ef4444;">
                        <h4 style="color: #ef4444; margin-top: 0;"><i class="fas fa-times-circle"></i> ${issue.title}</h4>
                        <p style="color: #64748b; font-size: 15px;">${issue.description}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : `
        <div class="pdf-page">
            <div class="page-header warning">
                <h2><i class="fas fa-exclamation-triangle"></i> CRITICAL: Missing Foundation</h2>
                <p>You are operating an invisible business in 2025.</p>
            </div>
            
            <div class="content-box warning-box" style="margin-top: 60px; padding: 40px;">
                <h3 style="font-size: 24px; color: #ef4444;"><i class="fas fa-store-slash"></i> A Store With No Address</h3>
                <p style="font-size: 20px; line-height: 1.6; margin-top: 20px;">
                    ${data.missing_website_pain}
                </p>
            </div>
            
            <div class="content-box success-box" style="margin-top: 40px; padding: 40px;">
                <h3 style="font-size: 24px; color: #10b981;"><i class="fas fa-hard-hat"></i> The Solution</h3>
                <p style="font-size: 18px; line-height: 1.6; margin-top: 20px;">
                    Your competitors have functioning websites capturing local searches right now. Building a modern, mobile-first, SEO-optimized website is <strong>Step 1</strong> to stopping the revenue bleed.
                </p>
            </div>
        </div>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Presence Audit - ${lead.business_name}</title>
    <!-- GHL removes head, but for PDF rendering via Playwright, this is perfectly fine -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        /* Base PDF Print Styles */
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

        body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #0a0e1a 0%, #0d1425 50%, #080d1a 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #f1f5f9;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            font-weight: 400;
        }

        /* Enforce exact page breaks for 8.5x11 PDF */
        .pdf-page {
            width: 8.5in;
            height: 11in;
            padding: 0.75in 0.8in;
            box-sizing: border-box;
            background: linear-gradient(135deg, #0a0e1a 0%, #0d1425 100%) !important;
            page-break-after: always;
            position: relative;
            overflow: hidden;
        }

        .pdf-page:last-child {
            page-break-after: auto;
        }

        /* Premium Typography */
        h1, h2, h3, h4 {
            font-weight: 800;
            margin: 0;
            line-height: 1.1;
            letter-spacing: -0.02em;
        }
        h1 { font-size: 56px; }
        h2 { font-size: 34px; }
        h3 { font-size: 24px; font-weight: 700; }
        h4 { font-size: 18px; font-weight: 600; }

        p {
            color: #cbd5e1;
            line-height: 1.6;
            font-weight: 400;
        }

        strong { font-weight: 700; color: #fff; }

        .page-header {
            border-bottom: 2px solid rgba(56, 189, 248, 0.2);
            padding-bottom: 20px;
            margin-bottom: 40px;
            background: linear-gradient(90deg, rgba(56, 189, 248, 0.05), transparent);
            padding: 20px;
            margin: -20px -20px 40px -20px;
            border-radius: 12px 12px 0 0;
        }
        .page-header.warning {
            background: linear-gradient(90deg, rgba(239, 68, 68, 0.08), transparent);
            border-bottom-color: rgba(239, 68, 68, 0.3);
        }
        .page-header.warning h2 { color: #ef4444; text-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
        .page-header h2 {
            font-size: 36px;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .page-header p {
            font-size: 17px;
            color: #94a3b8;
            margin-top: 10px;
            font-weight: 500;
        }

        /* Content Boxes */
        .content-box {
            background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            padding: 28px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
        }

        .warning-box {
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02));
            border: 1px solid rgba(239, 68, 68, 0.3);
            box-shadow: 0 4px 24px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .success-box {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02));
            border: 1px solid rgba(16, 185, 129, 0.3);
            box-shadow: 0 4px 24px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .info-box {
            background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(56, 189, 248, 0.02));
            border: 1px solid rgba(56, 189, 248, 0.3);
            box-shadow: 0 4px 24px rgba(56, 189, 248, 0.2), inset 0 1px 0 rgba(255,255,255,0.1);
        }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }

        /* Premium Score Circle */
        .score-circle {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 72px;
            font-weight: 900;
            margin: 50px auto 30px;
            position: relative;
            background: ${data.digital_health_score > 70 ? 'radial-gradient(circle, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))' : data.digital_health_score > 40 ? 'radial-gradient(circle, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))' : 'radial-gradient(circle, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'};
            border: 8px solid ${data.digital_health_score > 70 ? '#10b981' : data.digital_health_score > 40 ? '#f59e0b' : '#ef4444'};
            color: ${data.digital_health_score > 70 ? '#10b981' : data.digital_health_score > 40 ? '#f59e0b' : '#ef4444'};
            box-shadow: 0 0 40px ${data.digital_health_score > 70 ? 'rgba(16, 185, 129, 0.4)' : data.digital_health_score > 40 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'},
                        inset 0 0 20px rgba(0,0,0,0.3);
        }

        /* Premium Stat Cards */
        .stat-card {
            text-align: center;
            padding: 35px 25px;
            background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.08);
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, currentColor, transparent);
            opacity: 0.5;
        }
        .stat-card .value {
            font-size: 56px;
            font-weight: 900;
            color: #fff;
            margin: 12px 0;
            text-shadow: 0 2px 10px rgba(0,0,0,0.5);
            letter-spacing: -0.03em;
        }
        .stat-card .label {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #94a3b8;
            font-weight: 600;
        }

        /* Footer Stamp for all pages */
        .page-footer {
            position: absolute;
            bottom: 0.45in;
            left: 0.8in;
            right: 0.8in;
            border-top: 1px solid rgba(255,255,255,0.08);
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .page-footer img { height: 22px; opacity: 0.6; }
        .page-footer span {
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
            letter-spacing: 0.5px;
        }

        /* Icon Styling */
        i.fas, i.fab {
            opacity: 0.9;
        }

        /* Gradient Text */
        .gradient-text {
            background: linear-gradient(135deg, #38bdf8, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body>

    <!-- PAGE 1: COVER & EXECUTIVE SUMMARY -->
    <div class="pdf-page">
        <div style="text-align: center; margin-top: 50px;">
            <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png" style="height: 65px; margin-bottom: 50px; filter: drop-shadow(0 4px 12px rgba(56, 189, 248, 0.3));">
            <h3 class="gradient-text" style="text-transform: uppercase; letter-spacing: 3px; font-size: 15px; font-weight: 700;">Custom Digital Presence Audit</h3>
            <h1 style="font-size: 58px; margin: 24px 0; line-height: 1.05; font-weight: 900;">Are Your Competitors<br><span class="gradient-text">Stealing Your Leads?</span></h1>
            <p style="font-size: 22px; color: #94a3b8; font-weight: 500; margin-top: 20px;">Prepared exclusively for</p>
            <p style="font-size: 26px; font-weight: 700; color: #fff; margin-top: 8px;">${lead.business_name}</p>
        </div>

        <div class="score-circle">
            ${data.digital_health_score}
        </div>
        <p style="text-align: center; font-size: 13px; text-transform: uppercase; letter-spacing: 2.5px; color: #64748b; margin-top: -20px; font-weight: 600;">Digital Health Score</p>

        <div class="content-box info-box" style="margin-top: 55px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <i class="fas fa-file-invoice-dollar" style="color: #38bdf8; font-size: 24px;"></i>
                <h3 style="color: #38bdf8; margin: 0; font-size: 20px; font-weight: 700;">Executive Summary</h3>
            </div>
            <p style="font-size: 19px; line-height: 1.6; color: #e2e8f0; font-weight: 500; margin: 0;">${data.executive_summary}</p>
        </div>

        <div class="page-footer">
            <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png">
            <span>CONFIDENTIAL AUDIT — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}</span>
        </div>
    </div>

    <!-- PAGE 2: GOOGLE MAPS & REVIEWS -->
    <div class="pdf-page">
        <div class="page-header">
            <h2><i class="fab fa-google" style="color: #38bdf8;"></i> Google Maps Authority</h2>
            <p>90% of local customers call the first 3 businesses they see on the map.</p>
        </div>

        <div class="grid-2">
            <div class="stat-card" style="border-bottom: 4px solid ${data.gbp_audit.rating >= 4.5 ? '#10b981' : '#ef4444'};">
                <div class="label">Your Google Rating</div>
                <div class="value">${data.gbp_audit.rating}<span style="font-size:24px; color:#64748b;">/5.0</span></div>
                <div style="color: #fbbf24;"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i></div>
            </div>
            <div class="stat-card" style="border-bottom: 4px solid ${data.gbp_audit.review_count > 50 ? '#10b981' : '#ef4444'};">
                <div class="label">Total Reviews</div>
                <div class="value">${data.gbp_audit.review_count}</div>
                <div style="color: #94a3b8; font-size: 14px;"><i class="fas fa-users"></i> Local Trust Signals</div>
            </div>
        </div>

        <div class="content-box warning-box" style="margin-top: 40px;">
            <h3 style="color: #ef4444; margin-bottom: 10px;"><i class="fas fa-exclamation-circle"></i> Why You Are Losing Calls:</h3>
            <p style="font-size: 18px; line-height: 1.6; font-weight: 600;">${data.gbp_audit.pain_point}</p>
        </div>

        <div style="margin-top: 45px;">
            <h3 style="margin-bottom: 24px; font-size: 22px; color: #f1f5f9; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-trophy" style="color: #fbbf24;"></i>
                Who Is Stealing Your Customers Right Now?
            </h3>
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${data.competitors.map((comp, i) => `
                    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 22px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 12px rgba(0,0,0,0.3);">
                        <div style="flex: 1;">
                            <div style="margin-bottom: 10px;">
                                <span style="background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-right: 12px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(56, 189, 248, 0.4);">#${i + 1} Maps Rank</span>
                                <span style="font-size: 21px; font-weight: 700; color: #fff;">${comp.name}</span>
                            </div>
                            <div style="margin-top: 10px; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                                <i class="fas fa-crown" style="color:#fbbf24; margin-right: 6px;"></i>
                                <span style="font-weight: 500;">${comp.why_they_win}</span>
                            </div>
                        </div>
                        <div style="text-align: right; padding-left: 20px; border-left: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 32px; font-weight: 900; color: #10b981; line-height: 1;">${comp.reviews}</div>
                            <div style="font-size: 12px; font-weight: 600; color: #cbd5e1; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">reviews</div>
                            <div style="color: #fbbf24; font-size: 14px; margin-top: 6px; font-weight: 600;">
                                <i class="fas fa-star"></i> ${comp.rating}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="page-footer">
            <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png">
            <span>CONFIDENTIAL AUDIT — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </div>
    </div>

    <!-- PAGE 3: WEBSITE OR MISSING ASSET -->
    ${websiteSectionHtml}

    <!-- PAGE 4: COMPETITOR RADAR & ACTION PLAN -->
    <div class="pdf-page">
        <div class="page-header">
            <h2><i class="fas fa-bullseye" style="color: #10b981;"></i> The Action Plan</h2>
            <p>How we stop the bleed and dominate your local area.</p>
        </div>

        <!-- Chart Container -->
        <div class="content-box" style="margin-bottom: 40px; padding: 10px; background: white;">
            <canvas id="radarChart" style="max-height: 350px;"></canvas>
        </div>

        <div>
            ${data.action_plan.map((step, idx) => `
                <div style="display: flex; margin-bottom: 28px; align-items: flex-start;">
                    <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #38bdf8, #6366f1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #fff; flex-shrink: 0; margin-right: 20px; box-shadow: 0 4px 16px rgba(56, 189, 248, 0.4);">
                        ${idx + 1}
                    </div>
                    <div style="flex: 1; padding-top: 4px;">
                        <h3 style="font-size: 20px; color: #fff; margin-bottom: 10px; font-weight: 700; line-height: 1.2;">${step.phase_name}</h3>
                        <p style="font-size: 15px; margin: 0; line-height: 1.6; color: #cbd5e1;">${step.description}</p>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="content-box success-box" style="margin-top: 50px; text-align: center; border-radius: 20px; padding: 40px 32px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%); pointer-events: none;"></div>
            <p style="color: #10b981; font-weight: 800; letter-spacing: 2px; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; position: relative;">Ready to Take Action?</p>
            <h2 style="font-size: 32px; margin-bottom: 28px; color: #fff; font-weight: 900; position: relative;">Let's fix this in 15 minutes.</h2>
            <div style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding: 18px 50px; border-radius: 50px; font-size: 26px; font-weight: 900; color: white; box-shadow: 0 8px 24px rgba(14, 165, 233, 0.5), 0 0 60px rgba(99, 102, 241, 0.3); position: relative;">
                <i class="fas fa-phone-alt" style="margin-right: 12px;"></i>786-340-1053
            </div>
            <p style="margin-top: 20px; font-size: 15px; color: #94a3b8; font-weight: 600; position: relative;">
                <i class="fas fa-mobile-alt" style="margin-right: 6px; color: #38bdf8;"></i>
                Text "<strong style="color: #10b981;">AUDIT</strong>" to book your free strategy call
            </p>
        </div>

        <div class="page-footer">
            <img src="https://image2url.com/r2/default/images/1772145663144-15dfb609-0dba-4039-94cc-2fbf6a2781f3.png">
            <span>CONFIDENTIAL AUDIT — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </div>
    </div>

    <!-- Chart rendering logic (executes when Playwright loads the page) -->
    <script>
        const ctx = document.getElementById('radarChart').getContext('2d');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Google Profile', 'Review Volume', 'Review Quality', 'Website SEO', 'Local Trust'],
                datasets: [
                    {
                        label: '${lead.business_name}',
                        data: [
                            ${data.competitor_comparison_data?.you?.google_profile || 20},
                            ${data.competitor_comparison_data?.you?.reviews_volume || 10},
                            ${data.competitor_comparison_data?.you?.reviews_quality || 30},
                            ${data.competitor_comparison_data?.you?.website_seo || 0},
                            ${data.competitor_comparison_data?.you?.local_trust || 20}
                        ],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        borderWidth: 4,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    },
                    {
                        label: 'Top Competitor',
                        data: [
                            ${data.competitor_comparison_data?.competitor?.google_profile || 90},
                            ${data.competitor_comparison_data?.competitor?.reviews_volume || 95},
                            ${data.competitor_comparison_data?.competitor?.reviews_quality || 95},
                            ${data.competitor_comparison_data?.competitor?.website_seo || 80},
                            ${data.competitor_comparison_data?.competitor?.local_trust || 90}
                        ],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        borderWidth: 4,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 3,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            display: true,
                            stepSize: 25,
                            color: '#64748b',
                            font: { size: 11, family: 'Inter', weight: '500' },
                            backdropColor: 'transparent'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.12)',
                            lineWidth: 1.5
                        },
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.08)',
                            lineWidth: 1.5
                        },
                        pointLabels: {
                            color: '#1e293b',
                            font: { size: 13, weight: '700', family: 'Inter' },
                            padding: 12
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#1e293b',
                            font: { size: 15, weight: '700', family: 'Inter' },
                            padding: 18,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: { enabled: false }
                },
                animation: false, // Disable animation for perfect PDF printing
                elements: {
                    line: {
                        tension: 0.1
                    }
                }
            }
        });
    </script>
</body>
</html>`;
};
