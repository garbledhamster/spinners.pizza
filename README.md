# Spinners Pizza — Grovespring, Missouri 🍕
**Handcrafted pizzas, BBQ, burgers & hometown hospitality.**  
Live site: https://spinners.pizza/

This repo contains the single-page marketing site for **Spinners Pizza**. It’s fast, accessible, SEO-tuned, and easy to maintain—most content is driven by small JSON files in `/data`.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Content (JSON) Schema](#content-json-schema)
- [Local Development](#local-development)
- [Deployment (GitHub Pages + Cloudflare)](#deployment-github-pages--cloudflare)
- [SEO & Local Discovery](#seo--local-discovery)
- [Performance Tips](#performance-tips)
- [Accessibility](#accessibility)
- [Maintenance Checklist](#maintenance-checklist)
- [Support](#support)
- [License](#license)

---

## Features
- **One-page, JSON-driven** site (hours, menu, gallery, reviews, about).
- **Local SEO**: canonical URL, Open Graph/Twitter cards, `robots.txt`, `sitemap.xml` (+ optional image sitemap).
- **Structured Data**: `Restaurant` + `FAQPage` JSON-LD; dynamic hours JSON-LD when parsable.
- **Accessibility**: skip link, ARIA labels, keyboard navigation for modals, motion-reduction respect.
- **Performance**: LCP image preload, lazy-loaded media, small JS footprint.
- **Mobile-first UI** using Tailwind CDN (no build step required).

---

## Tech Stack
- **HTML** (single page)
- **Tailwind CSS (CDN)** for styling
- **Vanilla JavaScript** for interactivity and data binding
- **Google Fonts** (Lora), **Google Analytics** (gtag)
- **Google Maps** embed (location)

> No frameworks, no bundlers—just static assets that can be served anywhere.

---

## Project Structure
