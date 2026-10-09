import { Check, Feather, ListTree, MoreHorizontal } from 'lucide-react';
export function ManuscriptPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="studio-surface relative overflow-hidden text-left shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-3 text-[11px]">
        <span className="flex items-center gap-2 font-medium">
          <Feather className="h-3.5 w-3.5 text-primary" />
          Bản thảo của bạn
        </span>
        <span className="flex items-center gap-1 text-primary">
          <Check className="h-3 w-3" />
          Đã lưu
        </span>
      </div>
      <div className="flex">
        <div className="hidden w-32 shrink-0 border-r bg-muted/30 p-4 md:block">
          <p className="studio-eyebrow mb-4">Mục lục</p>
          {['Lời mở đầu', 'Một khởi đầu mới', 'Những lá thư'].map((name, i) => (
            <div
              key={name}
              className={`mb-2 rounded-md px-2 py-2 text-[10px] leading-relaxed ${i === 1 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              {String(i + 1).padStart(2, '0')} · {name}
            </div>
          ))}
          <div className="mt-12 border-t pt-4 text-[10px] text-muted-foreground">
            <ListTree className="mb-2 h-4 w-4" />3 chương · 2.450 từ
          </div>
        </div>
        <div
          className={`min-w-0 flex-1 bg-card ${compact ? 'p-6' : 'p-7 sm:p-10'}`}
        >
          <p className="studio-eyebrow mb-5">Chương thứ nhất</p>
          <h3 className="mb-5 font-serif text-3xl font-medium">
            Một khởi đầu mới
          </h3>
          <div className="space-y-4 font-serif text-base leading-[1.85] text-foreground/85">
            <p>
              Buổi sáng ấy, thành phố thức dậy trong một màn sương mỏng. An mở
              cửa sổ, để những tia nắng đầu tiên chạm lên trang giấy còn trắng.
            </p>
            <p>
              Có những câu chuyện không bắt đầu bằng một chuyến đi. Chúng bắt
              đầu bằng khoảnh khắc ta quyết định ở lại, lắng nghe điều trái tim
              vẫn luôn muốn kể.
            </p>
            <p className="text-muted-foreground">
              Cô đặt bút xuống. Và thế giới của riêng mình, từ đó, mở ra.
              <span className="ml-1 inline-block h-4 w-px bg-primary align-middle" />
            </p>
          </div>
          <div className="mt-7 flex items-center justify-between border-t pt-4 text-[10px] text-muted-foreground">
            <span>Không gian cho từng câu chữ.</span>
            <MoreHorizontal className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
