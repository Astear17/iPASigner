{
  "product": {
    "name": "iOS SignTool",
    "type": "dark-themed SaaS webapp",
    "audience": ["iOS developers", "certificate managers", "sideloaders"],
    "primary_jobs_to_be_done": [
      "Sign an IPA with a P12 + mobileprovision quickly and safely",
      "Verify certificate validity/expiry and inspect metadata",
      "Change certificate password and download updated bundle"
    ],
    "success_actions": [
      "User completes upload → sees progress → downloads signed IPA",
      "User uploads cert assets → sees validity + expiry + issuer details",
      "User changes password → downloads ZIP result"
    ]
  },

  "brand_attributes": [
    "iOS-native dark aesthetic",
    "trustworthy + technical",
    "quietly premium (glass, blur, soft borders)",
    "fast feedback (progress, inline errors, success cards)"
  ],

  "design_personality": {
    "style_fusion": [
      "iDevicePatcher: fixed pill glass header + roomy spacing",
      "iPASigner: deep dark base + cyan/teal orbs overlay",
      "iOS 16/17 dark surfaces: subtle translucency + crisp separators"
    ],
    "layout_principles": [
      "Mobile-first, single-column forms",
      "Desktop: centered content column with wide breathing room; cards in 3-col grid on Home",
      "F-pattern reading flow; avoid centered text blocks"
    ]
  },

  "typography": {
    "font_family": {
      "primary": "Inter (already imported)",
      "fallback": "ui-sans-serif, system-ui"
    },
    "tailwind_font_classes": {
      "app_default": "font-sans",
      "numeric": "tabular-nums"
    },
    "type_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "h3": "text-lg font-semibold",
      "body": "text-sm md:text-base leading-relaxed",
      "small": "text-xs text-muted-foreground"
    },
    "usage_notes": [
      "Keep headings tight (tracking-tight) to feel iOS-like.",
      "Use tabular numbers for dates, serials, and hashes.",
      "Avoid all-caps except tiny badges (text-xs)."
    ]
  },

  "color_system": {
    "constraints": [
      "Preserve existing dark theme variables; do not break index.css token names.",
      "No dark/light toggle anywhere.",
      "Primary accents must remain cyan/teal family."
    ],
    "base_tokens_to_preserve": {
      "background": "hsl(222 18% 6%)",
      "primary_accent": "hsl(190 85% 52%)"
    },
    "recommended_semantic_tokens": {
      "note": "Implement by overriding existing CSS variables in :root.dark (or existing theme file) WITHOUT renaming tokens.",
      "tokens": {
        "--background": "222 18% 6%",
        "--foreground": "210 20% 98%",
        "--card": "222 18% 8%",
        "--card-foreground": "210 20% 98%",
        "--popover": "222 18% 8%",
        "--popover-foreground": "210 20% 98%",
        "--primary": "190 85% 52%",
        "--primary-foreground": "222 18% 6%",
        "--secondary": "220 14% 14%",
        "--secondary-foreground": "210 20% 98%",
        "--muted": "220 14% 14%",
        "--muted-foreground": "215 16% 70%",
        "--accent": "190 60% 18%",
        "--accent-foreground": "190 85% 52%",
        "--destructive": "0 72% 52%",
        "--destructive-foreground": "210 20% 98%",
        "--border": "220 14% 18%",
        "--input": "220 14% 18%",
        "--ring": "190 85% 52%",
        "--radius": "1rem"
      }
    },
    "glass_tokens_custom": {
      "glass_bg": "rgba(28, 28, 30, 0.60)",
      "glass_bg_soft": "rgba(28, 28, 30, 0.42)",
      "glass_border": "rgba(255,255,255,0.12)",
      "glass_border_strong": "rgba(255,255,255,0.15)",
      "glass_shadow": "0 18px 60px rgba(0,0,0,0.55)",
      "inner_highlight": "inset 0 1px 0 rgba(255,255,255,0.06)"
    },
    "state_colors": {
      "success": "hsl(160 84% 39%)",
      "warning": "hsl(43 96% 56%)",
      "info": "hsl(190 85% 52%)",
      "danger": "hsl(0 72% 52%)"
    }
  },

  "gradients_and_background": {
    "gradient_restriction_rule_ack": "Follow the global GRADIENT RESTRICTION RULE. Use gradients only as decorative background overlays; never on small elements.",
    "app_background_recipe": {
      "base": "bg-[hsl(var(--background))]",
      "orbs_overlay": [
        "Use 2 radial orbs only (<=20% viewport impact): cyan at 20%/10%, teal at 80%/0%.",
        "Keep opacity low (0.18–0.28) and blur large to avoid banding."
      ],
      "tailwind_example": "relative min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] overflow-x-hidden",
      "css_example": "background-image: radial-gradient(600px circle at 20% 10%, rgba(34, 211, 238, 0.22), transparent 55%), radial-gradient(700px circle at 80% 0%, rgba(45, 212, 191, 0.18), transparent 52%);"
    },
    "texture": {
      "noise_overlay": "Add a subtle noise layer via pseudo-element (opacity 0.05–0.08) to prevent flatness.",
      "implementation_hint": "Use a tiny base64 noise png or CSS noise gradient; ensure it does not reduce contrast."
    }
  },

  "layout_and_grid": {
    "global_container": {
      "max_width": "max-w-6xl",
      "padding": "px-4 sm:px-6",
      "top_offset_for_fixed_header": "pt-24 sm:pt-28",
      "section_spacing": "py-10 sm:py-14"
    },
    "home_grid": {
      "mobile": "grid grid-cols-1 gap-4",
      "desktop": "md:grid-cols-3 md:gap-6",
      "card_radius": "rounded-[32px]"
    },
    "forms_layout": {
      "pattern": "Single column form card; results render below as stacked cards/sections.",
      "desktop": "Use 2-column only for paired upload zones (P12 + mobileprovision) with md:grid-cols-2 gap-4; keep inputs large for drag/drop."
    }
  },

  "components": {
    "component_path": {
      "shadcn_ui": "/app/frontend/src/components/ui",
      "use_these": {
        "header_nav": "navigation-menu.jsx OR menubar.jsx (prefer navigation-menu for pill links)",
        "buttons": "button.jsx",
        "cards": "card.jsx",
        "tabs": "tabs.jsx",
        "inputs": "input.jsx, textarea.jsx, label.jsx",
        "progress": "progress.jsx",
        "dialogs": "dialog.jsx (confirmations)",
        "toasts": "sonner.jsx",
        "badges": "badge.jsx",
        "separators": "separator.jsx",
        "tooltips": "tooltip.jsx",
        "scroll_area": "scroll-area.jsx (long cert details)",
        "table": "table.jsx (cert metadata table)"
      }
    },

    "header": {
      "spec": {
        "position": "fixed top-3 left-1/2 -translate-x-1/2 z-50",
        "shape": "pill (rounded-full)",
        "surface": "glass_bg + blur",
        "blur": "backdrop-blur-[20px] (Tailwind arbitrary)",
        "border": "1px solid rgba(255,255,255,0.15)",
        "shadow": "soft drop shadow + inner highlight",
        "height": "h-12 sm:h-14",
        "content": "Brand left, nav links center/right; collapse to menu on mobile"
      },
      "tailwind_class_example": "fixed top-3 left-1/2 z-50 w-[min(980px,calc(100%-1.5rem))] -translate-x-1/2 rounded-full border border-white/15 bg-[rgba(28,28,30,0.60)] backdrop-blur-[20px] shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
      "nav_links": [
        {"label": "Home", "href": "/", "data_testid": "nav-home-link"},
        {"label": "Sign iPA", "href": "/signipa", "data_testid": "nav-signipa-link"},
        {"label": "Check Cert", "href": "/checkcert", "data_testid": "nav-checkcert-link"},
        {"label": "Cert Pass", "href": "/certpass", "data_testid": "nav-certpass-link"}
      ],
      "mobile_behavior": [
        "On <sm: show brand + a single Menu button opening a Sheet/Drawer.",
        "Use shadcn sheet.jsx for the mobile nav; keep same glass surface."
      ]
    },

    "cards": {
      "base_style": {
        "radius": "rounded-[32px]",
        "surface": "rgba(28,28,30,0.42) with blur(30px)",
        "border": "1px solid rgba(255,255,255,0.12)",
        "shadow": "0 18px 60px rgba(0,0,0,0.55)",
        "padding": "p-5 sm:p-6"
      },
      "tailwind_class_example": "rounded-[32px] border border-white/12 bg-[rgba(28,28,30,0.42)] backdrop-blur-[30px] shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
      "variants": {
        "feature_card": "Add icon badge + CTA button",
        "form_card": "Contains drag-drop zones + inputs + primary CTA",
        "result_card": "Shows success/error + metadata; include copy buttons",
        "danger_card": "For wrong password errors; use destructive border tint"
      }
    },

    "buttons": {
      "variants": {
        "primary": {
          "use": "Main CTAs: Sign, Check, Change Password, Download",
          "surface": "cyan→teal mild gradient (allowed; button is >100px)",
          "tailwind": "bg-gradient-to-r from-cyan-400/90 to-teal-400/90 text-slate-950 hover:from-cyan-300 hover:to-teal-300",
          "focus": "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
        },
        "secondary_glass": {
          "use": "Secondary actions: Reset, View logs, Copy",
          "tailwind": "bg-white/8 text-white hover:bg-white/12 border border-white/12",
          "note": "No gradients on secondary."
        },
        "ghost": {
          "use": "Nav link buttons, subtle actions",
          "tailwind": "bg-transparent hover:bg-white/6"
        }
      },
      "press_motion": "active:scale-[0.98] (no layout shift); transition only on background-color/opacity/shadow",
      "data_testid_examples": [
        "data-testid=\"signipa-submit-button\"",
        "data-testid=\"checkcert-submit-button\"",
        "data-testid=\"certpass-submit-button\"",
        "data-testid=\"download-signed-ipa-button\""
      ]
    },

    "forms_and_inputs": {
      "input_style": {
        "radius": "rounded-2xl",
        "surface": "bg-white/6",
        "border": "border-white/12",
        "focus": "ring-cyan/teal",
        "placeholder": "text-white/40"
      },
      "drag_drop_zone": {
        "spec": [
          "Large target (min-h-32), dashed border, subtle hover glow.",
          "Show file name + size after drop.",
          "Provide 'Browse' button for accessibility."
        ],
        "tailwind_example": "group relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-white/18 bg-white/4 px-4 py-6 text-sm text-white/70 hover:bg-white/6 focus-within:ring-2 focus-within:ring-cyan-400/60",
        "states": {
          "idle": "Icon + 'Drag & drop' + supported formats",
          "drag_over": "border-cyan-300/60 bg-cyan-400/5",
          "error": "border-red-400/50 bg-red-500/5",
          "success": "border-teal-300/50 bg-teal-400/5"
        },
        "data_testid": {
          "p12_zone": "upload-p12-dropzone",
          "mobileprovision_zone": "upload-mobileprovision-dropzone",
          "ipa_zone": "upload-ipa-dropzone",
          "zip_zone": "upload-zip-dropzone"
        }
      },
      "inline_errors": {
        "pattern": "Render error text directly under the field in a small Alert component.",
        "component": "alert.jsx",
        "tailwind": "mt-2 rounded-2xl border border-red-400/30 bg-red-500/10 text-red-100"
      }
    },

    "progress_and_steps": {
      "component": "progress.jsx",
      "pattern": [
        "Use a 4-step horizontal stepper on desktop; on mobile show vertical list + progress bar.",
        "Steps: Upload → Validate → Sign → Package",
        "No bouncing animations; use opacity/blur entrance only."
      ],
      "micro_interaction": "When step changes: animate opacity 0→1 and translateY 4px→0 (Framer Motion) with reduced-motion support."
    },

    "results": {
      "cert_info_sections": [
        "Validity (Not Before/Not After)",
        "Issuer/Subject",
        "Team ID / Bundle ID (if available)",
        "Fingerprint (SHA-1/SHA-256)",
        "Provision profile details"
      ],
      "presentation": {
        "use_table": "Use table.jsx for key/value pairs on desktop; stacked rows on mobile.",
        "copy_actions": "Add small secondary glass buttons with copy-to-clipboard."
      },
      "data_testid": {
        "cert_status": "cert-status-text",
        "cert_expiry": "cert-expiry-text",
        "cert_issuer": "cert-issuer-text",
        "cert_subject": "cert-subject-text"
      }
    },

    "qr_code_success": {
      "placement": "Sign IPA success card: right side on desktop, below on mobile.",
      "frame_style": "rounded-3xl bg-white/6 border border-white/12 p-4",
      "data_testid": "signed-ipa-qr-code"
    },

    "footer": {
      "content": "Built and deployed by Astear17",
      "style": "text-xs text-white/50 text-center py-10",
      "data_testid": "site-footer"
    }
  },

  "icons_and_illustration": {
    "icon_library": {
      "preferred": "lucide-react (already common with shadcn)",
      "note": "No emoji icons."
    },
    "icon_choices": {
      "sign": "PenTool or FileSignature",
      "check": "ShieldCheck",
      "password": "KeyRound",
      "upload": "Upload",
      "success": "CheckCircle2",
      "error": "AlertTriangle"
    }
  },

  "motion": {
    "library": {
      "recommended": "framer-motion",
      "install": "npm i framer-motion",
      "usage": "Use for subtle entrance/step transitions only; avoid layout shift."
    },
    "principles": [
      "No universal transitions.",
      "Prefer opacity + small translate (<=6px).",
      "Respect prefers-reduced-motion: reduce."
    ],
    "micro_interactions": {
      "buttons": "hover: brightness + subtle shadow; active scale 0.98",
      "dropzones": "hover border tint + background tint",
      "nav_links": "active route gets glass pill highlight"
    }
  },

  "accessibility": {
    "focus": [
      "All interactive elements must have visible focus ring (ring uses --ring cyan).",
      "Ensure focus ring offset contrasts against dark background."
    ],
    "contrast": [
      "Body text should be near-white (>=90% lightness) on deep dark.",
      "Muted text must still pass AA for small sizes; avoid <60% opacity for essential info."
    ],
    "forms": [
      "Every input has a <Label> and aria-describedby for errors.",
      "Drag-drop zones must be keyboard accessible via a hidden file input + Browse button."
    ]
  },

  "page_blueprints": {
    "home": {
      "hero": {
        "title": "iOS SignTool",
        "subtitle": "Sign IPAs, validate certificates, and rotate P12 passwords — in a single dark iOS-style workspace.",
        "layout": "Left-aligned hero copy; right side optional mini preview card (no big gradients).",
        "data_testid": {
          "title": "home-hero-title",
          "primary_cta": "home-primary-cta"
        }
      },
      "feature_cards": [
        {
          "title": "Sign IPA",
          "cta": "Get Started",
          "route": "/signipa",
          "data_testid": "home-feature-signipa-card"
        },
        {
          "title": "Check Certificate",
          "cta": "Get Started",
          "route": "/checkcert",
          "data_testid": "home-feature-checkcert-card"
        },
        {
          "title": "Change Cert Password",
          "cta": "Get Started",
          "route": "/certpass",
          "data_testid": "home-feature-certpass-card"
        }
      ]
    },
    "signipa": {
      "structure": [
        "Form card with tabs: Upload / URL / Library",
        "Below: progress stepper + logs (collapsible)",
        "Success card: download button + QR code"
      ],
      "data_testid": {
        "tabs": "signipa-source-tabs",
        "progress": "signipa-progress",
        "success_card": "signipa-success-card"
      }
    },
    "checkcert": {
      "structure": [
        "Top form card: two dropzones + password input + Check button",
        "Results below: status badge + metadata cards/table"
      ],
      "data_testid": {
        "form": "checkcert-form",
        "results": "checkcert-results"
      }
    },
    "certpass": {
      "structure": [
        "Tabs: Separate files | ZIP bundle",
        "Inputs: old password, new password",
        "Result: download ZIP card"
      ],
      "data_testid": {
        "tabs": "certpass-mode-tabs",
        "result": "certpass-result"
      }
    }
  },

  "images": {
    "image_urls": [
      {
        "category": "background",
        "description": "No external hero images needed; rely on gradient orbs + noise for iOS-like dark ambience.",
        "urls": []
      }
    ]
  },

  "engineering_notes_js": {
    "react_files": "Project uses .js (not .tsx). Keep components in JS and use prop-types only if already used.",
    "routing": "Ensure nav links match: /, /signipa, /checkcert, /certpass",
    "testing": "Add data-testid to all buttons/inputs/dropzones/nav links/results text",
    "do_not_touch": [
      "Do not add dark/light toggle",
      "Do not rename CSS variables in index.css; only override values"
    ]
  },

  "instructions_to_main_agent": [
    "Remove/ignore default CRA App.css centering patterns; do not center the whole app container.",
    "Implement fixed glass pill header using shadcn NavigationMenu + Sheet for mobile.",
    "Create a reusable <GlassCard> wrapper (composition over rewriting shadcn Card) that applies rounded-[32px], border-white/12, bg rgba(28,28,30,0.42), backdrop-blur-[30px], and shadow.",
    "Create a reusable <Dropzone> component with the specified states and data-testid attributes.",
    "Use Button variants: primary gradient (cyan→teal) and secondary glass; avoid gradients elsewhere.",
    "Home page: 3 feature cards grid with icons + Get Started buttons.",
    "Sign IPA: add stepper + progress + success card with QR code frame.",
    "Check Cert: render results below form as table/cards with copy buttons.",
    "Cert Pass: tabs for Separate vs ZIP; result download card.",
    "Footer must be exactly: 'Built and deployed by Astear17' centered small text."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
