const fs = require('fs');
let text = fs.readFileSync('src/components/jobs-list.tsx', 'utf8');

// Replace the top of return statement
const returnStart = \  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-12 animate-in fade-in duration-500 pt-6">
      {/* Left Filter Rail */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight mb-3">Search & Filters</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="Search roles, skills..."
              className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-border"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Score</label>
            <div className="flex flex-wrap gap-1.5">
              {SCORE_FILTERS.map((item) => (
                <Chip key={item.id} active={minScore === item.value} onClick={() => { setMinScore(item.value); setPage(1); }}>
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Experience</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={experience} onChange={(e) => { setExperience(e.target.value); setPage(1); }}>
              {EXPERIENCE.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
              {LOCATIONS.map((item) => <option key={item} value={item}>{item || "Any Location"}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
              {ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Tier</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }}>
              {TIERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Freshness</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={freshness} onChange={(e) => { setFreshness(e.target.value); setPage(1); }}>
              {FRESHNESS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
            <select className="w-full h-8 rounded-md border border-border bg-card px-2 text-xs focus:ring-1 focus:ring-accent outline-none" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All status</option>
              <option value="saved">Saved</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </aside>

      {/* Main Job List */}
      <main className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-muted-foreground">
            {total} jobs found
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <select className="h-8 rounded-md border-none bg-transparent px-2 text-xs font-medium focus:ring-0 outline-none cursor-pointer" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="newest">Newest</option>
              <option value="best">Best match</option>
              <option value="company">Company</option>
              <option value="location">City</option>
              <option value="country">Country</option>
            </select>
          </div>
        </div>
\;

// Replace from 'return (' to the start of '{scanLatest || scanSummary || scanning ?'
const originalReturnStart = \  return (
    <div>
      <PageIntro\;
const regex = /  return \(\n    <div>\n      <PageIntro[\s\S]*?\{scanLatest \|\| scanSummary \|\| scanning \?/m;

text = text.replace(regex, returnStart + '\n\n        {scanLatest || scanSummary || scanning ?');

fs.writeFileSync('src/components/jobs-list.tsx', text);
