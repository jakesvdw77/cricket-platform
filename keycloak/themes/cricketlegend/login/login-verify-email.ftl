<#--
  Cricket Legend override of the stock 24.0.3 login-verify-email.ftl. Same data and the same
  "resend" action (a GET to url.loginAction), laid out as the mockup: mail icon, address chip,
  explanation, a Resend button and a way out.
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false; section>
    <#if section = "header">
        ${msg("emailVerifyTitle")}
    <#elseif section = "form">
        <div class="cl-icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>
        </div>
        <p class="instruction">${msg("emailVerifyInstruction1")}</p>
        <div class="cl-chip">${(user.email!'')}</div>
        <p class="instruction">${msg("emailVerifyInstruction2")}</p>
        <a class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" href="${url.loginAction}">${msg("doResendEmail")}</a>
        <#if url.loginRestartFlowUrl?has_content>
            <p class="cl-center"><a href="${url.loginRestartFlowUrl}">${msg("doUseDifferentAccount")}</a></p>
        </#if>
    </#if>
</@layout.registrationLayout>
