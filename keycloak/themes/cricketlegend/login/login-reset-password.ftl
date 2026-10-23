<#--
  Cricket Legend override of the stock 24.0.3 login-reset-password.ftl. Only differences:
  the instruction sits above the field, the button reads "Send reset link" (msg doSendResetLink)
  and "Back to sign in" sits under the button. Everything else is the stock markup and logic.
-->
<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=false displayMessage=!messagesPerField.existsError('username'); section>
    <#if section = "header">
        ${msg("emailForgotTitle")}
    <#elseif section = "form">
        <form id="kc-reset-password-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
            <p class="instruction"><#if realm.duplicateEmailsAllowed>${msg("emailInstructionUsername")}<#else>${msg("emailInstruction")}</#if></p>
            <div class="${properties.kcFormGroupClass!}">
                <div class="${properties.kcLabelWrapperClass!}">
                    <label for="username" class="${properties.kcLabelClass!}"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                </div>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="username" name="username" class="${properties.kcInputClass!}" autofocus autocomplete="username" value="${(auth.attemptedUsername!'')}" aria-invalid="<#if messagesPerField.existsError('username')>true</#if>"<#if messagesPerField.existsError('username')> aria-describedby="input-error-username"</#if>/>
                    <#if messagesPerField.existsError('username')>
                        <span id="input-error-username" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('username'))?no_esc}
                        </span>
                    </#if>
                </div>
            </div>
            <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" type="submit" value="${msg("doSendResetLink")}"/>
            </div>
            <p class="cl-center"><a href="${url.loginUrl}">${kcSanitize(msg("backToLogin"))?no_esc}</a></p>
        </form>
    </#if>
</@layout.registrationLayout>
