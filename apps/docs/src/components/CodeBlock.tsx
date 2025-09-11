import type { HTMLAttributes } from 'react';
import { codeToHtml } from 'shiki';

type Props = {
  code: string;
  lang?: string;
  lineNumbers?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export default async function CodeBlock({ code, lang = 'ts', lineNumbers = true, className, ...rest }: Props) {
  const html = await codeToHtml(code, {
    lang,
   theme: 'github-dark-default'
  });

  // Make the background transparent so it blends with our card
  const htmlTransparent = html.replace(/background-color:[^;]+;/, 'background-color: transparent;');

  return (
    <div
      className={className}
      data-line-numbers={lineNumbers ? '' : undefined}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: htmlTransparent }}
      {...rest}
    />
  );
}
