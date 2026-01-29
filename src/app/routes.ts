import { createBrowserRouter } from "react-router";
import { Layout } from "@/app/components/Layout";
import { Home } from "@/app/components/Home";
import { ArticleView } from "@/app/components/ArticleView";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "article/:id", Component: ArticleView },
    ],
  },
]);
