import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { builtinModules, createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default [
	// Bundle for CommonJS with preserved module structure
	{
		input: "index.ts",
		external: [...Object.keys(pkg.dependencies || {}), ...builtinModules],
		plugins: [
			resolve({ extensions: [".js", ".ts"], preferBuiltins: true, modulesOnly: true }),
			commonjs(),
			typescript({
				tsconfig: "./tsconfig.json",
				declaration: false,
				outDir: undefined,
				rootDir: undefined,
				exclude: ["node_modules", "dist"],
			}),
		],
		output: [
			{
				dir: "dist",
				format: "cjs",
				sourcemap: true,
				preserveModules: true,
				preserveModulesRoot: "src",
				entryFileNames: () => "[name].cjs",
				banner: (chunk) => {
					// Add shebang only to command files
					return chunk.facadeModuleId.includes("commands") ? "#!/usr/bin/env node" : "";
				},
			},
		],
	},
];
