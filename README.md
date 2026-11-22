# Spinner's Pizza Website

Welcome to the official website for **Spinner's Pizza**, a local pizzeria, BBQ, and burger joint in **Grovespring, MO**. This website was created as a project to support **Spinner's Pizza**, a beloved family-owned business in the community. It was a way for me to contribute something special to my dad's friend Tim, who runs the pizza place, and give them an online presence that reflects their hard work and delicious offerings.

## Build and verify locally

GitHub Pages serves the static files in the root of the repository. The build assembles the homepage from the layout, menu, hours, and restaurant content.

~~~sh
npm ci
npx playwright install chromium webkit
npm run build
npm test
npx html-validate index.html
~~~

Serve the repository over HTTP to use the chef guide. See [chef guide verification](site/chef-tour/README.md) for browser checks. The public homepage is checked in. An isolated preview can use `npm run build:preview` to add `noindex`.

Posted hours come from `data/hours.json`. Put effective dates, weekly hours and dated exceptions in `data/visit-hours.json` once the restaurant publishes a date range. Mark unresolved holidays inside that range as `unconfirmed`. The site shows the weekly posting and a phone fallback when a date cannot be confirmed.

The site uses Spinners' published pizza, menu and dining-room photos. The chef sprites and the dessert, pizza box and Ozarks illustrations were created for this redesign. The Ozarks illustration is separate from the restaurant map.

Pushing or merging to `main` deploys to spinners.pizza. Run `npm run build -- --check` and verify phone, map and hours in the assembled public build before merging.

## Purpose of the Website

The goal of this website is to provide a digital space for **Spinner's Pizza** to showcase their menu, restaurant hours, customer reviews, and location. The website also includes a gallery of the restaurant’s interior, giving potential customers a glimpse into the cozy and welcoming atmosphere.

This project was created out of love for the local community, as well as a desire to support my dad's hobby pig farm, which operates nearby. My dad wanted to give Tim some street cred, and this website was a perfect way to do that. I worked on this for free to help promote the pizzeria and to give back to the community.

## Features

- **Menu Section**: A detailed menu that showcases the variety of food options available at Spinner's Pizza, including house specials, appetizers, pizzas, burgers, and desserts.
- **Hours & Location**: A date picker for posted hours and closures, carry-out details, and a link to directions.
- **Gallery**: Photos of the restaurant's interior, giving customers a visual tour of the space.
- **Customer Reviews**: Attributed reviews with links to their sources.
- **Discounts for Heroes**: A section dedicated to honoring first responders, service members, and police officers with special discounts.
- **Responsive Design**: The website is built with responsive design, ensuring a smooth user experience on both desktop and mobile devices.

## Why I Created This Website

I created this website as part of my journey to give back to the local community while practicing my skills in web development. My dad wanted to help his friend Tim at Spinner's Pizza by giving him a professional website, and I was happy to step in and make it happen. The website is fully functional and designed to help attract new customers and support the local business.

## Tech Stack

- **HTML**: Used for structuring the content of the website.
- **CSS**: Responsive layout and motion that respects the visitor’s preference.
- **JavaScript**: The date picker, medallion controls and gallery dialog. Essential visit information is available with scripts disabled.
- **Favicon & Metadata**: Custom metadata and a favicon to improve SEO and social media presence.
- **Google Maps Link**: Directions open on request.

## Support Me

If you appreciate the work that went into this project, feel free to support me on **Buy Me a Coffee**! Your support helps me continue creating websites and resources for conscious communities, covering hosting fees, and assisting those in need of technical support. I truly appreciate your generosity!

[Support me on Buy Me a Coffee](https://buymeacoffee.com/garbledhamster)

## License

This project is open source and free to use. Feel free to fork or contribute to the project if you would like to make improvements or add new features!

---

Thank you for checking out this project! I hope this website helps **Spinner's Pizza** grow and bring delicious food to even more people in **Grovespring, MO**. 😄
