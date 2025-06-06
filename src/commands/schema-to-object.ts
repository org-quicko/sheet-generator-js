#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';
import * as fs from 'fs';
import path from 'path';
import { ObjectGeneratorUtil } from '../utils';

// Configure CLI command
const schemaToObjectProgram = new Command();

schemaToObjectProgram
    .name('schema-to-objects')
    .alias('s2o')
    .description('Generate TypeScript classes from JSON schema file or directory')
    .version('1.0.0')
    .requiredOption('-i, --input <path>', 'Input schema file or directory')
    .requiredOption('-o, --output <path>', 'Output directory for generated TypeScript files')
    .action(async (options) => {
        try {
            const inputPath = path.resolve(options.input);
            const outputDir = path.resolve(options.output);

            // Check if input exists
            if (!fs.existsSync(inputPath)) {
                console.error(`Error: Input path "${inputPath}" does not exist.`);
                process.exit(1);
            }

            // Create output directory if needed
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const processFile = (inputFile: string, relativeOutputPath: string) => {
              if (!inputFile.endsWith('.json')) { // Assuming .schema.json, but could also be just .json
                  console.error(`Error: Input file ${inputFile} must be a JSON file (.json)`);
                  return; // Skip non-JSON files
              }

              try {
                // Read and parse schema file
                const schemaContent = fs.readFileSync(inputFile, 'utf-8');
                const schema = JSON.parse(schemaContent);

                // Generate TypeScript classes from schema
                // Pass the relative output path to the generator
                ObjectGeneratorUtil.generate(schema, path.join(outputDir, relativeOutputPath));

                console.log(`TypeScript classes generated successfully for: ${inputFile} in ${path.join(outputDir, relativeOutputPath)}`);

              } catch (error: Error | any) { 
                console.error(`Error during TypeScript class generation for ${inputFile}:`, error.message || error); // more robust error message
                // Don't exit; continue with other files.
              }
          };


          if (fs.lstatSync(inputPath).isDirectory()) {
              const processDirectory = (directory: string, relativePath: string = "") => {
                    fs.readdirSync(directory).forEach((file) => {
                        const fullPath = path.join(directory, file);
                        const stat = fs.lstatSync(fullPath)

                        if(stat.isDirectory()){
                            processDirectory(fullPath, path.join(relativePath, file))
                        } else if (stat.isFile()){
                            processFile(fullPath, relativePath)
                        }
                    })
              }
              processDirectory(inputPath)
          } else {
            processFile(inputPath, "")
          }
        } catch (error) {
            console.error('Error during TypeScript class generation:', error);
            process.exit(1);
        }
    });

// Parse CLI arguments
schemaToObjectProgram.parse(process.argv);