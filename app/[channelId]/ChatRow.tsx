import {Fragment, memo} from "react"

export interface Badge {
    name: string;
    src: string;
}

export interface Chat {
    uuid: string;
    nickname: string;
    badges: Badge[];
    color: number | string;
    emojis: Record<string, string>;
    message: string;
}

export const nicknameColors = [
    "#ECA843", "#EEA05D", "#EA723D", "#EAA35F", "#E98158", "#E97F58", "#E76D53", "#E66D5F", "#E56B79", "#E16490",
    "#E481AE", "#E68199", "#DC5E9A", "#E16CB5", "#D25FAC", "#D263AE", "#D66CB4", "#D071B6", "#BA82BE", "#AF71B5",
    "#A96BB2", "#905FAA", "#B38BC2", "#9D78B8", "#8D7AB8", "#7F68AE", "#9F99C8", "#717DC6", "#5E7DCC", "#5A90C0",
    "#628DCC", "#7994D0", "#81A1CA", "#ADD2DE", "#80BDD3", "#83C5D6", "#8BC8CB", "#91CBC6", "#83C3BB", "#7DBFB2",
    "#AAD6C2", "#84C194", "#B3DBB4", "#92C896", "#94C994", "#9FCE8E", "#A6D293", "#ABD373", "#BFDE73", "#CCE57D"
]

const emojiRegex = /{:([a-zA-Z0-9_]+):}/g

function ChatRow(props: Chat) {
    const {nickname, badges, color, emojis, message} = props
    const match = message.match(emojiRegex)

    return (
        <div data-from={nickname}>
            <span className="meta" style={{ color: typeof color == "number" ? nicknameColors[color] : color }}>
                {badges.map(({name, src}, i) => (
                    <img key={i} className="badge" alt={name} src={src} />
                ))}
                <span className="name">{nickname}</span>
                <span className="colon">:</span>
            </span>
            <span className="message">
                {match ? message.split(emojiRegex).map((part, i) => (
                    <Fragment key={i}>
                        {i % 2 == 0 ? part : <span className="emote_wrap">
                            <img className="emoticon" alt={`{:${part}:}`} src={emojis[part]}/>
                        </span>}
                    </Fragment>
                )) : message}
            </span>
        </div>
    )
}

export default memo(ChatRow)
