/** Adresses : fragment mal encodé, et pages connues de public/404.html. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { cheminDuFragment } from "../src/lib/routeur.jsx";

describe("cheminDuFragment", () => {
  test("un fragment mal encodé ramène à l'accueil au lieu de lever", () => {
    expect(cheminDuFragment("#/%")).toBe("/");
    expect(cheminDuFragment("#/comptoir%E0")).toBe("/");
  });

  test("un fragment ordinaire donne son chemin", () => {
    expect(cheminDuFragment("#/succes/classement")).toBe("/succes/classement");
    expect(cheminDuFragment("#/biblioth%C3%A8que")).toBe("/bibliothèque");
    expect(cheminDuFragment("")).toBe("/");
    expect(cheminDuFragment("#comptoir")).toBe("/");
  });
});

test("public/404.html connaît toutes les pages de App.jsx", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const page404 = readFileSync(new URL("../public/404.html", import.meta.url), "utf8");
  const routes = [...app.matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]);
  const connues = JSON.parse(page404.match(/var connues = (\[[^\]]*\])/)[1]);
  expect(routes.length).toBeGreaterThan(5);
  expect(routes.filter((r) => !connues.includes(r))).toEqual([]);
});
