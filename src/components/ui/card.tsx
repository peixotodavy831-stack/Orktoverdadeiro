import * as React from 'react';
import { cn } from '../../lib/utils';
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn('orkto-pricing-card',className)} {...props}/>);
export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn('orkto-pricing-card-header',className)} {...props}/>);
export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn('orkto-pricing-card-content',className)} {...props}/>);
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn('orkto-pricing-card-footer',className)} {...props}/>);
export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({className,...props},ref)=><h3 ref={ref} className={cn('orkto-pricing-card-title',className)} {...props}/>);
export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({className,...props},ref)=><p ref={ref} className={cn('orkto-pricing-card-description',className)} {...props}/>);
Card.displayName='Card';CardHeader.displayName='CardHeader';CardContent.displayName='CardContent';CardFooter.displayName='CardFooter';CardTitle.displayName='CardTitle';CardDescription.displayName='CardDescription';
