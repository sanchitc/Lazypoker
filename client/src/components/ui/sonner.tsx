import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-felt group-[.toaster]:text-bone ' +
            'group-[.toaster]:brass-hairline group-[.toaster]:shadow-lg group-[.toaster]:rounded-md',
          description: 'group-[.toast]:text-bone-dim',
          actionButton: 'group-[.toast]:bg-brass group-[.toast]:text-[hsl(220_18%_8%)]',
          cancelButton: 'group-[.toast]:bg-felt-rim group-[.toast]:text-bone-dim',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
