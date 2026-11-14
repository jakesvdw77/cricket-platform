<#import "template.ftl" as layout>
<#-- Cricket Legend: the stock info page plus a "Back To Application" link on every info page, including "You are already signed in"
     (owner, 2026-11-13). The link goes to, in order: the page redirect, the pending action, the client's Home URL (Keycloak admin, Clients,
     cricketlegend, Settings, Home URL: set it to the app's /post-login), then the theme property appUrl. With none of them set there is no link. -->
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        <#if messageHeader??>
            ${messageHeader}
        <#else>
            ${message.summary}
        </#if>
    <#elseif section = "form">
    <div id="kc-info-message">
        <p class="instruction">${message.summary}<#if requiredActions??><#list requiredActions>: <b><#items as reqActionItem>${kcSanitize(msg("requiredAction.${reqActionItem}"))?no_esc}<#sep>, </#items></b></#list><#else></#if></p>
        <#-- The stock page-redirect and pending-action links (skipLink hides them). The way back to the app is the Back To Cricket Legend link
             that template.ftl draws under every card (theme property homeUrl), so a person who is already signed in is never stuck. -->
        <#if !skipLink?? && pageRedirectUri?has_content>
            <p><a href="${pageRedirectUri}">${kcSanitize(msg("backToApplication"))?no_esc}</a></p>
        <#elseif !skipLink?? && actionUri?has_content>
            <p><a href="${actionUri}">${kcSanitize(msg("proceedWithAction"))?no_esc}</a></p>
        </#if>
    </div>
    </#if>
</@layout.registrationLayout>
