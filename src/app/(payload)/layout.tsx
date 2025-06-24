/* This is a route group to isolate Payload routes from the rest of the app */
import type { Metadata } from "next";
import type { ServerFunctionClient } from "payload";
import configPromise from "@payload-config";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";
import { importMap } from "./admin/importMap.js";
import "@payloadcms/next/css";
import "./admin/custom.css";

export const metadata: Metadata = {
  title: "AI Power Rankings CMS",
  description: "Content Management System for AI Power Rankings",
  robots: {
    index: false,
    follow: false,
  },
};

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({
    ...args,
    config: configPromise,
    importMap,
  });
};

const Layout: React.FC<Args> = ({ children }) => {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head />
      <body className="payload-admin-body">
        <RootLayout config={configPromise} importMap={importMap} serverFunction={serverFunction}>
          {children}
        </RootLayout>
      </body>
    </html>
  );
};

export default Layout;
