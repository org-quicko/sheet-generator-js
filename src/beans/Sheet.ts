import { Block } from './Block';

export interface Sheet {
    name: string;
    '@entity': string;
    blocks: Block[];
}