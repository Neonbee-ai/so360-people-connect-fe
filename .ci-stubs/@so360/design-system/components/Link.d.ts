import React from 'react';
export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    /**
     * `inline` is for links inside running text: always underlined so the link is not
     * conveyed by colour alone (WCAG 1.4.1). Opt out with `underline={false}`.
     */
    variant?: 'primary' | 'muted' | 'inline';
    /** Opens in a new tab with a trailing icon and safe rel. */
    external?: boolean;
    /** Always underline. Default: on hover, except `variant="inline"` (always). `false` = hover only. */
    underline?: boolean;
}
export declare const Link: React.FC<LinkProps>;
