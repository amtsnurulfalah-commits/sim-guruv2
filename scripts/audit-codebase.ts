/** Read-only structural inventory; candidates are never automatic deletion approval. */
import ts from "typescript";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
const root = process.cwd();
const names: string[] = [];
async function walk(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(ts|tsx|mjs)$/.test(path)) names.push(path);
  }
}
async function main() {
  await Promise.all(
    ["src", "scripts", "tests"].map((dir) => walk(resolve(dir))),
  );
  const config = ts.readConfigFile(resolve("tsconfig.json"), ts.sys.readFile);
  if (config.error) throw Error("AUDIT_CONFIG_INVALID");
  const options = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  ).options;
  const incoming = new Map<string, Set<string>>();
  const dynamicExpressions: { file: string; line: number }[] = [];
  const dependencies = new Set<string>();
  const files = names.sort();
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function record(text: string) {
      const target = ts.resolveModuleName(text, file, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      if (target && !target.includes("/node_modules/")) {
        const path = resolve(target);
        const references = incoming.get(path) ?? new Set<string>();
        references.add(relative(root, file));
        incoming.set(path, references);
      } else if (
        !text.startsWith(".") &&
        !text.startsWith("@/") &&
        !text.startsWith("node:") &&
        text !== "server-only"
      ) {
        dependencies.add(
          text.startsWith("@")
            ? text.split("/").slice(0, 2).join("/")
            : text.split("/")[0]!,
        );
      }
    }
    function visit(node: ts.Node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        record(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) record(argument.text);
        else
          dynamicExpressions.push({
            file: relative(root, file),
            line:
              source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const sourceFiles = files.filter((f) => relative(root, f).startsWith("src/"));
  const inventory = {
    baseCommit: "7f5c6cc38979917e25a759105c92c74054846ae3",
    limitations:
      "Literal module graph only; framework routes are roots, not dead code. Dynamic expressions, SQL RPCs, operational entrypoints and exports require human review.",
    analyzedFiles: files.length,
    sourceFiles: sourceFiles.length,
    pages: sourceFiles.filter((f) => f.endsWith("/page.tsx")).length,
    apiRouteFiles: sourceFiles.filter((f) => f.endsWith("/route.ts")).length,
    sqlMigrations: (await readdir("supabase/migrations")).filter((f) =>
      f.endsWith(".sql"),
    ).length,
    unreferencedModuleCandidates: sourceFiles
      .filter(
        (f) => !relative(root, f).startsWith("src/app/") && !incoming.has(f),
      )
      .map((f) => relative(root, f)),
    dynamicExpressions,
    importedPackages: [...dependencies].sort(),
    files: files.map((f) => ({
      path: relative(root, f),
      importedBy: [...(incoming.get(f) ?? [])].sort(),
    })),
  };
  await mkdir(resolve("docs/verification"), { recursive: true });
  await writeFile(
    resolve("docs/verification/codebase-audit-inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );
  console.log(JSON.stringify({ ...inventory, files: undefined }));
}
void main().catch(() => {
  console.error("AUDIT_INVENTORY_FAILED");
  process.exitCode = 1;
});
