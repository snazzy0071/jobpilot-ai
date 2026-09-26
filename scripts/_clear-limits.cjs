const {createClient}=require("@supabase/supabase-js");
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
c.from("anonymous_rate_limits").delete().or("scope.like.auth_%,scope.like.lead_%").then(r=>console.log(r.error||"limits cleared"));
