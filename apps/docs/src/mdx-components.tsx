import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Files, File, Folder } from 'fumadocs-ui/components/files';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';

// use this function to get MDX components, you will need it for rendering MDX
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Additional Fumadocs UI components used in docs
    Files,
    File,
    Folder,
    Tabs,
    Tab,
    Steps,
    Step,
    ...components,
  };
}
