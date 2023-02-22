# Fable

> **Warning**
> WIP: Not usable as a library just yet

<img width="1440" alt="CleanShot 2023-02-21 at 19 18 53@2x" src="https://user-images.githubusercontent.com/4020798/220438709-ef9edac8-7596-46bc-aefe-0c37fb6e2820.png">

A generator for presentations at Oxide, if you'd like to experiment with it you can run:

```sh
 npm install
```

and then:

```sh
 npm run dev
```

## Usage

Will eventually be importable as a cli-tool / library. The user passes a path to a `toml`
file, and the generator starts a web server with the presentation.

Initially using templates provided by the library, eventually allowing the user to provide
their own custom templates.

## Navigation

Currently you can go to the previous and next slide with the left and right arrow keys.

## Templates

A template is a file with:

1. A template schema that validates that the page's content matches what the template needs
   to render.

2. A React component that uses the page content provided by the user.

## Content

Example file:

```
# Page 1
[[pages]]
template = "Basic"
title = "Customer Design Councils"
list=[
"Over 20 participants, from F500 enterprises to large cloud SaaS companies have helped us shape the product they want to run",
"Industries include Financial, Healthcare, Media, Technology, Cloud SaaS",
"Having a closer relationship throughout development has allowed us to progress through the sales process ahead of launch"]

# Page 2
[[pages]]
template = "Basic"
title = "Customer Engagement"
text = """
Customers have helped design this product with us, ensuring it will meet their needs;  we have formalized engagement into a _customer design council_. <br>

Allowing customers to participate has yielded a _better product_, and ensured a foundational set of enterprise customers.
"""
```

An array of objects in a `toml` file. Validation is not done on file import by Typescript.
Instead we use [zod](https://zod.dev/) to ensure the user's content matches the templates
schema.

The template attribute should match the template component name.
