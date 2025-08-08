import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../css/login.css";
import logo from '../imgs/mainlogo.png';

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleSignupClick = () => {
        navigate('/signup');
    };

    const changeEmail = (e) => setEmail(e.target.value);
    const changePassword = (e) => setPassword(e.target.value);

    return (
        <div className="login-wrapper">
            <div className="login-header">
                <img src={logo} className="login-header-logo" alt="로고" />
            </div>

            <div className="login-container">
                <div className="login-inner">
                    <div className='loginlogo-con'>
                        <img src={logo} className='loginlogo' alt="로그인로고" />
                    </div>

                    <div className="login-slogan">
                        <p className="slogan-main">이메일로 로그인 하세요.</p>
                        <p className="slogan-sub">맞춤형 행사 추천 서비스, <strong>Eventory</strong></p>
                    </div>


                    <form className="login-input-form">
                        <input
                            type="text"
                            value={email}
                            className="login-email"
                            placeholder="이메일"
                            onChange={changeEmail}
                        />
                        <input
                            type="password"
                            value={password}
                            className="login-password"
                            placeholder="비밀번호"
                            onChange={changePassword}
                        />
                        <button type="submit" className="login-btn">로그인</button>
                    </form>

                    <p className="signup-link">
                        아직 회원이 아니신가요?{" "}
                        <span onClick={handleSignupClick} className="login-to-signup">
                            회원가입
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
