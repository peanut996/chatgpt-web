import { useEffect, useMemo, useState } from "react";

import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";

import styles from "./settings.module.scss";

import ResetIcon from "../icons/reload.svg";
import CloseIcon from "../icons/close.svg";
import ClearIcon from "../icons/clear.svg";

import { List, ListItem, Popover } from "./ui-lib";

import { IconButton } from "./button";
import {
  ALL_MODELS,
  SubmitKey,
  Theme,
  useAccessStore,
  useChatStore,
} from "../store";
import { Avatar } from "./chat";

import Locale, { AllLangs, changeLang, getLang } from "../locales";

function SettingItem(props: {
  title: string;
  subTitle?: string;
  children: JSX.Element;
  onClick?: () => void;
}) {
  return (
    <ListItem>
      <div onClick={props.onClick} className={styles["settings-title"]}>
        <div>{props.title}</div>
        {props.subTitle && (
          <div className={styles["settings-sub-title"]}>{props.subTitle}</div>
        )}
      </div>
      {props.children}
    </ListItem>
  );
}

export function Settings(props: { closeSettings: () => void }) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [config, updateConfig, resetConfig, clearSessions] = useChatStore(
    (state) => [
      state.config,
      state.updateConfig,
      state.resetConfig,
      state.clearAllData,
      state.clearSessions,
    ],
  );
  const [clickCount, setClickCount] = useState(0);
  const [models, setModels] = useState(ALL_MODELS);

  const handleClick = () => {
    setClickCount(clickCount + 1);
    if (clickCount + 1 === 5) {
      // 触发彩蛋
      setModels([
        ...ALL_MODELS,
        {
          name: "GPT-4",
          model: "gpt-4",
          available: true,
        },
      ]);
    }
  };

  useEffect(() => {}, []);

  const accessStore = useAccessStore();
  const enabledAccessControl = useMemo(
    () => accessStore.enabledAccessControl(),
    [accessStore],
  );

  return (
    <>
      <div className={styles["window-header"]}>
        <div className={styles["window-header-title"]}>
          <div className={styles["window-header-main-title"]}>
            {Locale.Settings.Title}
          </div>
          <div className={styles["window-header-sub-title"]}>
            {Locale.Settings.SubTitle}
          </div>
        </div>
        <div className={styles["window-actions"]}>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<ClearIcon />}
              onClick={clearSessions}
              bordered
              title={Locale.Settings.Actions.ClearAll}
            />
          </div>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<ResetIcon />}
              onClick={resetConfig}
              bordered
              title={Locale.Settings.Actions.ResetAll}
            />
          </div>
          <div className={styles["window-action-button"]}>
            <IconButton
              icon={<CloseIcon />}
              onClick={props.closeSettings}
              bordered
              title={Locale.Settings.Actions.Close}
            />
          </div>
        </div>
      </div>
      <div className={styles["settings"]}>
        <List>
          <SettingItem title={Locale.Settings.Avatar}>
            <Popover
              onClose={() => setShowEmojiPicker(false)}
              content={
                <EmojiPicker
                  lazyLoadEmojis
                  theme={EmojiTheme.AUTO}
                  onEmojiClick={(e) => {
                    updateConfig((config) => (config.avatar = e.unified));
                    setShowEmojiPicker(false);
                  }}
                />
              }
              open={showEmojiPicker}
            >
              <div
                className={styles.avatar}
                onClick={() => setShowEmojiPicker(true)}
              >
                <Avatar role="user" />
              </div>
            </Popover>
          </SettingItem>

          <SettingItem title={Locale.Settings.SendKey}>
            <select
              value={config.submitKey}
              onChange={(e) => {
                updateConfig(
                  (config) =>
                    (config.submitKey = e.target.value as any as SubmitKey),
                );
              }}
            >
              {Object.values(SubmitKey).map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </select>
          </SettingItem>

          <ListItem>
            <div className={styles["settings-title"]}>
              {Locale.Settings.Theme}
            </div>
            <select
              value={config.theme}
              onChange={(e) => {
                updateConfig(
                  (config) => (config.theme = e.target.value as any as Theme),
                );
              }}
            >
              {Object.values(Theme).map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </select>
          </ListItem>

          <SettingItem title={Locale.Settings.Lang.Name}>
            <select
              value={getLang()}
              onChange={(e) => {
                changeLang(e.target.value as any);
              }}
            >
              {AllLangs.map((lang) => (
                <option value={lang} key={lang}>
                  {Locale.Settings.Lang.Options[lang]}
                </option>
              ))}
            </select>
          </SettingItem>

          <SettingItem
            title={Locale.Settings.FontSize.Title}
            subTitle={Locale.Settings.FontSize.SubTitle}
          >
            <input
              type="range"
              title={`${config.fontSize ?? 14}px`}
              value={config.fontSize}
              min="12"
              max="18"
              step="1"
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.fontSize = Number.parseInt(e.currentTarget.value)),
                )
              }
            ></input>
          </SettingItem>

          <SettingItem title={Locale.Settings.TightBorder}>
            <input
              type="checkbox"
              checked={config.tightBorder}
              onChange={(e) =>
                updateConfig(
                  (config) => (config.tightBorder = e.currentTarget.checked),
                )
              }
            ></input>
          </SettingItem>

          <SettingItem title={Locale.Settings.SendPreviewBubble}>
            <input
              type="checkbox"
              checked={config.sendPreviewBubble}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.sendPreviewBubble = e.currentTarget.checked),
                )
              }
            ></input>
          </SettingItem>
        </List>
        <List>
          <SettingItem
            title={Locale.Settings.Prompt.Disable.Title}
            subTitle={Locale.Settings.Prompt.Disable.SubTitle}
          >
            <input
              type="checkbox"
              checked={config.disablePromptHint}
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.disablePromptHint = e.currentTarget.checked),
                )
              }
            ></input>
          </SettingItem>
        </List>
        <List>
          {enabledAccessControl ? (
            <SettingItem
              title={Locale.Settings.AccessCode.Title}
              subTitle={Locale.Settings.AccessCode.SubTitle}
            >
              <input
                value={accessStore.accessCode}
                type="text"
                placeholder={Locale.Settings.AccessCode.Placeholder}
                onChange={(e) => {
                  accessStore.updateCode(e.currentTarget.value);
                }}
              ></input>
            </SettingItem>
          ) : (
            <></>
          )}
        </List>

        <List>
          <SettingItem title={Locale.Settings.Model} onClick={handleClick}>
            <select
              value={config.modelConfig.model}
              onChange={(e) => {
                updateConfig(
                  (config) =>
                    (config.modelConfig.model = e.currentTarget.value),
                );
              }}
            >
              {models.map((v) => (
                <option value={v.model} key={v.name} disabled={!v.available}>
                  {v.name}
                </option>
              ))}
            </select>
          </SettingItem>
        </List>
      </div>
    </>
  );
}
