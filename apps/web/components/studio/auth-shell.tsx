import { StudioBrand } from './brand';
import { ManuscriptPreview } from './manuscript-preview';
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between border-r bg-muted/30 p-10 lg:flex xl:p-16">
        <StudioBrand />
        <div className="my-12 max-w-lg">
          <p className="studio-eyebrow mb-5">Không gian cho trí tưởng tượng</p>
          <h1 className="mb-7 font-serif text-5xl font-medium leading-tight">
            Mỗi câu chuyện
            <br />
            đều xứng đáng
            <br />
            <span className="italic text-primary">được viết ra.</span>
          </h1>
          <ManuscriptPreview compact />
        </div>
        <p className="text-xs text-muted-foreground">
          Novelist Studio · Viết theo nhịp của bạn.
        </p>
      </aside>
      <main className="flex min-w-0 flex-col items-center justify-center p-5 sm:p-10">
        <div className="mb-10 lg:hidden">
          <StudioBrand />
        </div>
        {children}
      </main>
    </div>
  );
}
