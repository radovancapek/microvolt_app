/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        micro: {
          olive: "#2E3104",
          lime: "#9CA432",
          paper: "#EFEFEF",
          ink: "rgba(0,0,0,0.82)",
          error: "#ef9a9a",
        },
      },
    },
  },
  plugins: [],
};