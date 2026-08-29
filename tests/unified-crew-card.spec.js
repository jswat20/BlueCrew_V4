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
    await page.waitForTimeout(750);
    const back=page.getByTestId("crew-card-back");
    await expect(back.locator(".crew-credential-age")).toHaveCount(0);
    await expect(back).not.toContainText("Birthdate");
    const organization=back.locator(".crew-card-organization").first();
    await expect(organization).toBeVisible();
    const organizationGeometry=await organization.evaluate(element=>{const style=getComputedStyle(element);return {width:parseFloat(style.width),height:parseFloat(style.height),wordBreak:style.wordBreak,borderRadius:style.borderRadius,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth};});
    expect(organizationGeometry.width).toBeGreaterThan(organizationGeometry.height*2);
    expect(organizationGeometry.wordBreak).toBe("normal");
    expect(organizationGeometry.borderRadius).not.toBe("50%");
    expect(organizationGeometry.scrollWidth).toBeLessThanOrEqual(organizationGeometry.clientWidth+1);
    await page.getByTestId("profile-edit-crew-card").click();
    await expect(page.getByTestId("crew-card-self-edit-mode")).toBeVisible();
    await expect(page.getByTestId("profile-login-email-readonly")).toBeVisible();
  });
  test("Profile Administrator history starts at the top without an empty Umpire statistics row",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    for(const width of [768,1280]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{resetProfileCardSide();renderPage("profile");});
      await page.getByTestId("profile-card-back").click();
      await page.waitForTimeout(750);
      const geometry=await page.getByTestId("crew-card-back").evaluate(back=>{
        const rect=selector=>back.querySelector(selector).getBoundingClientRect();
        const body=rect(".profile-card-back-body");
        const summary=rect(".profile-card-back-summary");
        const history=rect(".crew-credential-history-launch");
        const organizations=rect(".crew-credential-eligibility");
        const contact=rect(".crew-credential-contact");
        return {role:back.dataset.cardRole,ageCount:back.querySelectorAll(".crew-credential-age").length,historyTop:history.top,organizationsTop:organizations.top,historyBottom:history.bottom,summaryTop:summary.top,contactTop:contact.top,bodyTop:body.top};
      });
      expect(geometry.role).toBe("administrator");
      expect(geometry.ageCount).toBe(0);
      expect(geometry.historyTop-geometry.summaryTop,`history top gap at ${width}`).toBeLessThan(12);
      expect(geometry.historyTop-geometry.bodyTop,`history/body top gap at ${width}`).toBeLessThanOrEqual(24);
      expect(Math.abs(geometry.historyTop-geometry.contactTop),`history/contact top alignment at ${width}`).toBeLessThan(12);
      expect(geometry.organizationsTop,`organizations follow history at ${width}`).toBeGreaterThanOrEqual(geometry.historyBottom);
    }
  });
  test("uses the canonical card for view and operational edit with admin-only identity controls",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp; expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");openCrewCredentialCard("crew-unified");});
    await page.getByTestId("crew-card-view-information").click();
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
    for(const width of [1440,430,390,360,320]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>openCrewCredentialCard("crew-unified"));
      await page.getByTestId("crew-card-view-information").click();
      await expect(page.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
      await page.waitForTimeout(750);
      await expect(page.getByTestId("crew-card-emergency-contact")).toBeVisible();
      await expect(page.getByTestId("crew-card-emergency-phone")).toBeVisible();
      const containment=await page.locator(".crew-credential-contact").evaluate((panel,viewportWidth)=>{
        const rows=[...panel.querySelectorAll("dl > div")];
        const panelRect=panel.getBoundingClientRect();
        const lastRect=rows.at(-1).getBoundingClientRect();
        return {overflow:getComputedStyle(panel).overflow,lastBottom:lastRect.bottom,panelBottom:panelRect.bottom,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight,desktopDividers:viewportWidth<=430?rows.some(row=>getComputedStyle(row.querySelector("dd")).borderLeftWidth!=="0px"):false,rowColumns:viewportWidth<=430?[...new Set(rows.map(row=>getComputedStyle(row).gridTemplateColumns.split(" ").length))]:[]};
      },width);
      expect(containment.overflow).not.toBe("hidden");
      expect(containment.lastBottom).toBeLessThanOrEqual(containment.panelBottom+1);
      expect(containment.scrollHeight).toBeLessThanOrEqual(containment.clientHeight+1);
      expect(containment.desktopDividers).toBe(false);
      if(width<=430) expect(containment.rowColumns).toEqual([1]);
      await page.evaluate(()=>closeCrewCard());
    }
  });

  test("Umpire card geometry is viewer-independent and keeps a centered 2x2 statistics grid",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");openCrewCredentialCard("crew-unified");});
    await page.getByTestId("crew-card-view-information").click();
    await page.waitForTimeout(750);
    const geometry=await page.getByTestId("crew-card-back").evaluate(back=>{
      const stats=back.querySelector(".crew-credential-age");
      const cells=[...stats.children].map(cell=>cell.getBoundingClientRect());
      const header=back.querySelector(".profile-card-back-header").getBoundingClientRect();
      const title=back.querySelector(".profile-card-back-title").getBoundingClientRect();
      const id=back.querySelector(".profile-card-back-id").getBoundingClientRect();
      const center=rect=>rect.top+rect.height/2;
      return {role:back.dataset.cardRole,count:cells.length,columns:getComputedStyle(stats).gridTemplateColumns.split(" ").length,headerTitleDelta:Math.abs(center(header)-center(title)),headerIdDelta:Math.abs(center(header)-center(id))};
    });
    expect(geometry).toMatchObject({role:"umpire",count:4,columns:2});
    expect(geometry.headerTitleDelta).toBeLessThan(5);
    expect(geometry.headerIdDelta).toBeLessThan(5);
  });
  test("modal Umpire front keeps canonical Profile proportions at phone widths",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");});
    for(const width of [320,360,390,430]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>openCrewCredentialCard("crew-unified"));
      const geometry=await page.getByTestId("crew-card-dialog").evaluate(dialog=>{
        const rect=selector=>dialog.querySelector(selector).getBoundingClientRect();
        const stage=rect(".crew-card-stage");
        const face=rect(".profile-crew-card-front");
        const photo=rect(".profile-card-front-photo");
        const name=rect(".profile-card-name-block");
        const eligibility=rect(".crew-credential-front-eligibility");
        return {stageRatio:stage.width/stage.height,faceRatio:face.width/face.height,photoWidthRatio:photo.width/face.width,photoHeightRatio:photo.height/face.height,nameTop:name.top,photoBottom:photo.bottom,eligibilityBottom:eligibility.bottom,faceBottom:face.bottom,pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
      });
      expect(geometry.stageRatio,`stage ratio at ${width}`).toBeCloseTo(5/7,2);
      expect(geometry.faceRatio,`face ratio at ${width}`).toBeCloseTo(5/7,2);
      expect(geometry.photoWidthRatio,`photo width at ${width}`).toBeGreaterThan(.75);
      expect(geometry.photoHeightRatio,`photo height at ${width}`).toBeGreaterThan(.44);
      expect(Math.abs(geometry.nameTop-geometry.photoBottom),`photo/name join at ${width}`).toBeLessThan(2);
      expect(geometry.faceBottom-geometry.eligibilityBottom,`footer containment at ${width}`).toBeGreaterThanOrEqual(0);
      expect(geometry.faceBottom-geometry.eligibilityBottom,`footer inset at ${width}`).toBeLessThanOrEqual(31);
      expect(geometry.pageOverflow,`page overflow at ${width}`).toBeLessThanOrEqual(1);
      await page.evaluate(()=>closeCrewCard());
    }
  });

  test("desktop Contact Information retains columns without separator artifacts",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");});
    for(const width of [768,1280]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>openCrewCredentialCard("crew-unified"));
      await page.getByTestId("crew-card-view-information").click();
      await page.waitForTimeout(750);
      const separators=await page.locator(".crew-credential-contact dl > div").evaluateAll(rows=>rows.map(row=>{
        const dt=row.querySelector("dt");
        const dd=row.querySelector("dd");
        const styles=[row,dt,dd].map(element=>getComputedStyle(element));
        const pseudos=[dt,dd].flatMap(element=>["::before","::after"].map(pseudo=>getComputedStyle(element,pseudo)));
        return {columns:getComputedStyle(row).gridTemplateColumns.split(" ").length,borders:styles.flatMap(style=>[style.borderLeftWidth,style.borderRightWidth]),pseudoVisible:pseudos.some(style=>style.display!=="none"&&style.content!=="none"&&style.content!=='""'&&parseFloat(style.width||"0")>0)};
      }));
      expect(separators.every(item=>item.columns===2)).toBe(true);
      expect(separators.every(item=>item.borders.every(width=>width==="0px")&&!item.pseudoVisible)).toBe(true);
      await page.evaluate(()=>closeCrewCard());
    }
  });
  test("Crew Card emails prefer the at-sign wrap opportunity and keep mail links intact",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("admin@unified.test","password"))).success).toBe(true);
    await page.evaluate(async()=>{await crewService.loadAdministrativeCrew();renderPage("crew");});
    const cases=[
      {email:"a@b.co",width:320,expectSingleLine:true},
      {email:"alex.montgomery@example.com",width:360},
      {email:"johnsmithverylongnameplusmorechars@example.com",width:390,expectAtBreak:true},
      {email:"official@very-long-subdomain.exampleorganization.org",width:430},
      {email:"alex.montgomery@example.com",width:768},
      {email:"a@b.co",width:1280,expectSingleLine:true}
    ];
    for(const item of cases){
      await page.setViewportSize({width:item.width,height:900});
      await page.evaluate(email=>{
        administrativeCrewSnapshot=administrativeCrewSnapshot.map(member=>member.id==="crew-unified"?{...member,email}:member);
        openCrewCredentialCard("crew-unified");
      },item.email);
      await page.getByTestId("crew-card-view-information").click();
      await page.waitForTimeout(750);
      const emailGeometry=await page.getByTestId("crew-card-copy-email").evaluate(link=>{
        const local=link.querySelector(".crew-contact-email-local").getBoundingClientRect();
        const domain=link.querySelector(".crew-contact-email-domain").getBoundingClientRect();
        const allRects=[local,domain];
        const container=link.closest("dd").getBoundingClientRect();
        return {href:link.getAttribute("href"),text:link.textContent,hasParts:Boolean(local.width&&domain.width),sameLine:Math.abs(local.top-domain.top)<1,localBottom:local.bottom,domainTop:domain.top,contained:allRects.every(rect=>rect.left>=container.left-1&&rect.right<=container.right+1)};
      });
      expect(emailGeometry.href).toBe(`mailto:${item.email}`);
      expect(emailGeometry.text).toBe(item.email);
      expect(emailGeometry.hasParts).toBe(true);
      expect(emailGeometry.contained,`email containment at ${item.width}`).toBe(true);
      if(item.expectSingleLine) expect(emailGeometry.sameLine,`short email at ${item.width}`).toBe(true);
      if(item.expectAtBreak) expect(emailGeometry.domainTop,`@ wrap at ${item.width}`).toBeGreaterThanOrEqual(emailGeometry.localBottom-1);
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
      await page.getByTestId("crew-card-view-information").click();
      await expect(page.getByTestId("crew-card-flipper")).toHaveClass(/is-flipped/);
      await page.waitForTimeout(750);
      await expect(page.getByTestId("crew-card-back")).toBeVisible();
      const geometry=await page.getByTestId("crew-card-dialog").evaluate(dialog=>{
        const id=dialog.querySelector('[data-testid="crew-card-id"]');
        const region=id?.parentElement; const name=dialog.querySelector("#crew-card-title");
        const values=[...dialog.querySelectorAll(".crew-credential-contact dd")];
        return {dialogOverflowX:getComputedStyle(dialog).overflowX,bodyOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,contactOverflow:values.some(value=>value.scrollWidth>value.clientWidth+1),idCentered:id&&region?(getComputedStyle(region).justifyItems==="center"||getComputedStyle(region).textAlign==="center"):false,nameHeight:name?.getBoundingClientRect().height||0,nameLine:name?(parseFloat(getComputedStyle(name).lineHeight)||40):40};
      });
      expect(geometry.dialogOverflowX,`dialog overflow at ${width}`).toBe("hidden");
      expect(geometry.bodyOverflow,`document overflow at ${width}`).toBeLessThanOrEqual(1);
      expect(geometry.contactOverflow,`contact clipping at ${width}`).toBe(false);
      expect(geometry.idCentered,`Personnel ID centering at ${width}`).toBe(true);
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
  test("own Profile and modal card use matching normalized front geometry",async({supabaseAuthApp})=>{
    const {page}=supabaseAuthApp;
    expect((await page.evaluate(()=>loginService.loginWithPassword("login@unified.test","password"))).success).toBe(true);
    const measure=locator=>locator.evaluate(root=>{const box=selector=>root.querySelector(selector).getBoundingClientRect();const face=box(".profile-crew-card-front");const photo=box(".profile-card-front-photo");const name=box(".profile-card-name-block");const footer=box(".crew-credential-front-eligibility");return {faceRatio:face.width/face.height,photoWidth:photo.width/face.width,photoHeight:photo.height/face.height,nameTop:(name.top-face.top)/face.height,footerHeight:footer.height/face.height};});
    for(const width of [320,360,390,430]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{resetProfileCardSide();renderPage("profile");});
      const profile=await measure(page.getByTestId("profile-crew-card-experience"));
      await page.evaluate(()=>openCrewCredentialCard("crew-unified"));
      const modal=await measure(page.getByTestId("crew-card-dialog"));
      for(const key of Object.keys(profile)) expect(Math.abs(profile[key]-modal[key]),`${key} parity at ${width}`).toBeLessThan(.04);
      await page.evaluate(()=>closeCrewCard());
    }
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
