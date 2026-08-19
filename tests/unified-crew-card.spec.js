import { test, expect } from "./fixtures/supabase-auth.fixture.js";

const admin={id:"admin-unified",auth_user_id:"auth-admin-unified",organization_id:"organization-1",first_name:"Admin",last_name:"Unified",email:"admin@unified.test",role:"administrator",status:"approved",communication_preferences:{}};
const umpire={id:"profile-unified",auth_user_id:"auth-profile-unified",organization_id:"organization-1",first_name:"Alexandria",last_name:"Montgomery",email:"login@unified.test",phone:"5551112222",home_phone:"5552223333",address:"10 Shared Street",contact_preference:"text",emergency_contact:"Emergency Person",emergency_contact_phone:"5553334444",role:"umpire",status:"approved",communication_preferences:{}};
const member={id:"crew-unified",organization_id:"organization-1",profile_id:umpire.id,first_name:"Alexandria",last_name:"Montgomery",email:"crew@unified.test",phone:"5550000000",active:true,eligible_levels:["12U"],preferences:{preferredLevels:["12U"]},notes:"Admin only"};

test.describe("Unified Crew Card administrator",()=>{
  test.use({supabaseScenario:{profile:admin,crewId:null,crewMembers:[member],organizationProfiles:[umpire],identityDiagnostics:[{crew_member_id:member.id,identity_status:"linked",login_email:umpire.email,linked_role:"umpire",linked_status:"approved"}]}});
  test("administrator opens the profile-owned self editor without a Crew identity",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(()=>renderPage("profile"));
    await page.getByTestId("profile-card-back").click();
    await page.getByTestId("profile-edit-crew-card").click();
    await expect(page.getByTestId("crew-card-self-edit-mode")).toBeVisible();
    await expect(page.getByTestId("profile-login-email-readonly")).toBeVisible();
  });
  test("uses the canonical card for view and operational edit with admin-only identity controls",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");openCrewCredentialCard("crew-unified");});
    await expect(page.getByTestId("crew-card-login-email")).toHaveText("login@unified.test");
    await expect(page.getByTestId("crew-card-copy-email")).toContainText("crew@unified.test");
    await expect(page.getByTestId("crew-card-password-reset")).toBeVisible(); await expect(page.getByTestId("crew-card-unlink-identity")).toBeVisible();
    await page.getByTestId("crew-card-edit").click();
    await expect(page.getByTestId("crew-card-admin-edit-mode")).toBeVisible();
    await expect(page.locator("#crew-first-name,#crew-phone,#crew-email,#crew-active,#crew-notes")).toHaveCount(5);
    await expect(page.getByTestId("crew-preferred-level-select-all")).toBeVisible();
    await expect(page.locator("#profile-home-phone,#profile-address,#profile-emergency-contact")).toHaveCount(0);
  });
  test("contact information grows to contain emergency rows on desktop and mobile",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");});
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>openCrewCredentialCard("crew-unified"));
      await expect(page.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
      await expect(page.getByTestId("crew-card-emergency-contact")).toBeVisible();
      await expect(page.getByTestId("crew-card-emergency-phone")).toBeVisible();
      const containment=await page.locator(".crew-credential-contact").evaluate(panel=>{
        const rows=[...panel.querySelectorAll("dl > div")];
        const panelRect=panel.getBoundingClientRect();
        const lastRect=rows.at(-1).getBoundingClientRect();
        return {overflow:getComputedStyle(panel).overflow,lastBottom:lastRect.bottom,panelBottom:panelRect.bottom,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight};
      });
      expect(containment.overflow).not.toBe("hidden");
      expect(containment.lastBottom).toBeLessThanOrEqual(containment.panelBottom+1);
      expect(containment.scrollHeight).toBeLessThanOrEqual(containment.clientHeight+1);
      await page.evaluate(()=>closeCrewCard());
    }
  });
  test("canonical card and hosted editor have measured containment at pilot breakpoints",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");});
    for(const width of [1440,1280,1100,1000,900,768,430,390]){
      await page.setViewportSize({width,height:850});
      await page.evaluate(()=>openCrewCredentialCard("crew-unified"));
      await expect(page.getByTestId("crew-card-back")).toBeVisible();
      const geometry=await page.getByTestId("crew-card-dialog").evaluate(dialog=>{
        const id=dialog.querySelector('[data-testid="crew-card-id"]');
        const region=id?.parentElement; const name=dialog.querySelector("#crew-card-title");
        const values=[...dialog.querySelectorAll(".crew-credential-contact dd")];
        return {dialogOverflow:dialog.scrollWidth-dialog.clientWidth,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,contactOverflow:values.some(value=>value.scrollWidth>value.clientWidth+1),idCenter:id&&region?Math.abs((id.getBoundingClientRect().left+id.getBoundingClientRect().width/2)-(region.getBoundingClientRect().left+region.getBoundingClientRect().width/2)):99,nameHeight:name?.getBoundingClientRect().height||0,nameLine:parseFloat(getComputedStyle(name).lineHeight)||40};
      });
      expect(geometry.dialogOverflow,`dialog overflow at ${width}`).toBeLessThanOrEqual(1);
      expect(geometry.bodyOverflow,`document overflow at ${width}`).toBeLessThanOrEqual(1);
      expect(geometry.contactOverflow,`contact clipping at ${width}`).toBe(false);
      expect(geometry.idCenter,`Personnel ID centering at ${width}`).toBeLessThanOrEqual(2);
      if(width>=768) expect(geometry.nameHeight/geometry.nameLine,`name fragmentation at ${width}`).toBeLessThan(2.2);
      if(width>=768){await page.getByTestId("crew-card-edit").click(); const overflow=await page.getByTestId("crew-card-admin-edit-mode").evaluate(shell=>{const bounds=shell.getBoundingClientRect();const descendants=[...shell.querySelectorAll("input,select,textarea,button,.form-group")].filter(element=>element.getClientRects().length>0);const right=descendants.sort((a,b)=>b.getBoundingClientRect().right-a.getBoundingClientRect().right)[0];const left=descendants.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];return {overflowX:getComputedStyle(shell).overflowX,maxRight:right.getBoundingClientRect().right-bounds.right,minLeft:bounds.left-left.getBoundingClientRect().left};}); expect(overflow.overflowX).not.toBe("scroll"); if(overflow.maxRight>1||overflow.minLeft>1) throw new Error(`Editor containment ${width}: ${JSON.stringify(overflow)}`);}
      await page.evaluate(()=>closeCrewCard());
    }
  });
});

test.describe("Unified Crew Card umpire security and responsiveness",()=>{
  test.use({supabaseScenario:{profile:umpire,crewId:member.id,crewMembers:[member]}});
  test("Profile exposes only owned fields and refuses another profile target",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; expect((await page.evaluate(()=>loginService.loginWithPassword("login@unified.test","password"))).success).toBe(true); await page.evaluate(()=>renderPage("profile"));
    await page.getByTestId("profile-card-back").click();
    await page.getByTestId("profile-edit-crew-card").click();
    await expect(page.locator("#profile-phone,#profile-home-phone,#profile-address,#profile-contact-preference,#profile-emergency-contact,#profile-emergency-phone")).toHaveCount(6);
    await expect(page.locator("#crew-first-name,#crew-email,#crew-active,#crew-notes,.crew-level-checkbox,.crew-preferred-level-checkbox,[data-testid='crew-card-password-reset']")).toHaveCount(0);
    const denied=await page.evaluate(async()=>accountService.updateAuthenticatedProfile("another-profile",{phone:"5559999999"})); expect(denied.success).toBe(false); expect(denied.message).toMatch(/Unauthorized/i);
  });
  test("card view and edit mode remain usable at production viewport boundaries",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; expect((await page.evaluate(()=>loginService.loginWithPassword("login@unified.test","password"))).success).toBe(true);
    for(const width of [1440,1280,1024,768,430,390]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{resetProfileCardSide();renderPage("profile");});
      const card=page.getByTestId("profile-crew-card-experience");
      await expect(card).toBeVisible();
      expect(await card.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
      expect(await card.locator(".profile-card-stage").evaluate(n=>n.getBoundingClientRect().width/n.getBoundingClientRect().height)).toBeCloseTo(5/7,2);
      await page.getByTestId("profile-card-back").click();
      if(width<=600) await expect.poll(()=>card.locator(".profile-card-stage").evaluate(n=>n.getBoundingClientRect().height/n.getBoundingClientRect().width)).toBeGreaterThan(2);
      else if(width<=900) {
        const mobileBack=await card.locator(".profile-card-stage").evaluate(n=>({height:n.getBoundingClientRect().height,columns:getComputedStyle(n.querySelector(".profile-card-back-body")).gridTemplateColumns.split(" ").length}));
        expect(mobileBack.height).toBeGreaterThan(500);
        expect(mobileBack.columns).toBe(2);
      } else await expect.poll(()=>card.locator(".profile-card-stage").evaluate(n=>n.getBoundingClientRect().width/n.getBoundingClientRect().height)).toBeCloseTo(7/5,2);
      if(width>=1280){
        const geometry=await card.evaluate(node=>{
          const face=node.querySelector(".crew-credential-face-back");
          const summary=node.querySelector(".profile-card-back-summary");
          const age=node.querySelector(".crew-credential-age");
          const contact=node.querySelector(".crew-credential-contact");
          const rect=element=>element.getBoundingClientRect();
          return {card:rect(node).width,face:rect(face).width,summary:rect(summary).width,ageWidth:rect(age).width,contactWidth:rect(contact).width};
        });
        expect(geometry.summary).toBeGreaterThanOrEqual(245);
        expect(geometry.ageWidth).toBeGreaterThanOrEqual(220);
        expect(geometry.contactWidth).toBeGreaterThanOrEqual(340);
        expect(geometry.face).toBeGreaterThanOrEqual(850);
      }
      await page.getByTestId("profile-edit-crew-card").click();
      await expect(page.getByTestId("profile-save")).toBeVisible();
      expect(await page.getByTestId("crew-card-dialog").evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
      await page.getByTestId("crew-card-self-edit-mode").getByRole("button",{name:"Cancel"}).click();
    }
  });
});
