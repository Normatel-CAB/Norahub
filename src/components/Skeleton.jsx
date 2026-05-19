function Box({ className = '' }) {
  return <div className={`animate-pulse bg-white/[0.07] rounded-lg ${className}`} />;
}

export function SkeletonProjectCard() {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10 animate-pulse min-h-[180px] flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <Box className="w-10 h-10 rounded-lg" />
        <Box className="w-16 h-5 rounded-full" />
      </div>
      <Box className="h-5 w-3/4 mb-2" />
      <Box className="h-3 mb-1.5" />
      <Box className="h-3 w-5/6 mb-4" />
      <Box className="h-9 mt-auto rounded-lg" />
    </div>
  );
}

export function SkeletonPainelCard() {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 border border-white/20 animate-pulse min-h-[280px] flex flex-col items-center justify-center gap-5">
      <Box className="w-20 h-20 rounded-full" />
      <div className="space-y-3 w-full text-center">
        <Box className="h-6 w-2/3 mx-auto" />
        <Box className="h-3 mx-6" />
        <Box className="h-3 w-5/6 mx-auto" />
      </div>
      <Box className="h-10 w-36 rounded-full" />
    </div>
  );
}

export function SkeletonUserRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse border-b border-white/[0.04]">
      <Box className="w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Box className="h-4 w-1/3" />
        <Box className="h-3 w-1/4" />
      </div>
      <Box className="h-6 w-20 rounded-full" />
      <Box className="h-8 w-24 rounded-lg" />
      <Box className="h-7 w-7 rounded-lg" />
    </div>
  );
}

export function SkeletonStatCards({ count = 3 }) {
  return (
    <div className={`grid grid-cols-${count} gap-3 sm:gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 sm:p-5 animate-pulse">
          <Box className="h-3 w-16 mb-2" />
          <Box className="h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonActivityRow() {
  return (
    <div className="flex items-start gap-3 p-3 animate-pulse">
      <Box className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Box className="h-4 w-1/2" />
        <Box className="h-3 w-3/4" />
        <Box className="h-3 w-1/4" />
      </div>
    </div>
  );
}
