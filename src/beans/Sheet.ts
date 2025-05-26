import { Block } from './Block.js';

export interface Sheet {
    name: string;
    '@entity': string;
    blocks: Block[];
}